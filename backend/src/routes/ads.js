const express = require('express');
const router = express.Router();

const supabase = require('../db/supabaseClient');
const { validateAdSubmission } = require('../validators/adValidator');
const { checkBidRange, checkImageDimensions } = require('../checks/deterministicChecks');
const { runAiPolicyReview } = require('../services/aiReviewService');
const { computeQualityScore, computeFinalRank } = require('../services/auctionService');

function nextAdId(sequenceNumber) {
  return `AD-${String(sequenceNumber).padStart(3, '0')}`;
}

// GET /api/auction/results — sec 4.5
router.get('/results', async (req, res) => {
  const { data: slots, error: slotsError } = await supabase
    .from('auction_slots')
    .select('id, ad_id, final_rank_score')
    .order('id');
  if (slotsError) {
    return res.status(500).json({ error: `Database error: ${slotsError.message}` });
  }

  const results = await Promise.all(
    slots.map(async (slot) => {
      if (!slot.ad_id) {
        return {
          slotId: slot.id,
          adId: null,
          headline: null,
          bidAmount: null,
          qualityScore: null,
          finalRankScore: null,
          reason: "Slot open, no approved ad currently ranked here."
        };
      }
      const { data: ad } = await supabase
        .from('ads')
        .select('headline, bid_amount, quality_score')
        .eq('id', slot.ad_id)
        .maybeSingle();
      return {
        slotId: slot.id,
        adId: slot.ad_id,
        headline: ad?.headline ?? null,
        bidAmount: ad?.bid_amount ?? null,
        qualityScore: ad?.quality_score ?? null,
        finalRankScore: slot.final_rank_score,
        reason: `Ranked here on a bid of $${ad?.bid_amount} combined with a quality score of ${ad?.quality_score}.`
      };
    })
  );

  return res.status(200).json({ slots: results });
});

// POST /api/ads — sec 4.1
router.post('/', async (req, res) => {
  const { headline, mediaUrl, bidAmount } = req.body || {};

  const validationError = validateAdSubmission({ headline, mediaUrl, bidAmount });
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const { count, error: countError } = await supabase
    .from('ads')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    return res.status(500).json({ error: `Database error: ${countError.message}` });
  }

  const adId = nextAdId((count || 0) + 1);
  const submittedAt = new Date().toISOString();

  const { error: insertError } = await supabase.from('ads').insert({
    id: adId,
    headline,
    media_url: mediaUrl,
    bid_amount: bidAmount,
    status: 'pending',
    submitted_at: submittedAt
  });

  if (insertError) {
    return res.status(500).json({ error: `Database error: ${insertError.message}` });
  }

  let reviewCards = [];
  let aiUnavailable = false;

  try {
    const [bidCard, imageCard, aiCards] = await Promise.all([
      Promise.resolve(checkBidRange(bidAmount)),
      checkImageDimensions(mediaUrl),
      runAiPolicyReview({ headline, mediaUrl })
    ]);
    reviewCards = [bidCard, imageCard, ...aiCards];
  } catch (err) {
    aiUnavailable = true;
    console.error('AI review failed:', err.message);
  }

  if (aiUnavailable) {
    return res.status(201).json({
      adId,
      status: 'pending',
      submittedAt,
      reviewCards: [],
      note: 'AI check unavailable, review manually.'
    });
  }

  const cardRows = reviewCards.map((card) => ({
    ad_id: adId,
    rule_name: card.ruleName,
    result: card.result,
    reason: card.reason,
    severity: card.severity
  }));

  const { error: cardsError } = await supabase.from('ad_review_cards').insert(cardRows);
  if (cardsError) {
    return res.status(500).json({ error: `Database error storing review cards: ${cardsError.message}` });
  }

  return res.status(201).json({
    adId,
    status: 'pending',
    submittedAt,
    reviewCards
  });
});

// POST /api/ads/:adId/review — sec 4.4
router.post('/:adId/review', async (req, res) => {
  const { adId } = req.params;
  const { reviewerId, decision } = req.body || {};

  const validDecisions = ['approved', 'rejected'];
  if (!validDecisions.includes(decision)) {
    return res.status(400).json({ error: `Invalid decision value, must be one of: ${validDecisions.join(', ')}.` });
  }

  const { data: ad, error: adError } = await supabase
    .from('ads')
    .select('*')
    .eq('id', adId)
    .maybeSingle();
  if (adError) {
    return res.status(500).json({ error: `Database error: ${adError.message}` });
  }
  if (!ad) {
    return res.status(404).json({ error: `No ad found with id ${adId}.` });
  }

  if (ad.status === 'approved' || ad.status === 'rejected') {
    return res.status(409).json({ error: `Ad ${adId} already has a recorded reviewer decision.` });
  }

  const reviewedAt = new Date().toISOString();

  if (decision === 'rejected') {
    const { error: updateError } = await supabase
      .from('ads')
      .update({ status: 'rejected', reviewer_id: reviewerId, reviewed_at: reviewedAt })
      .eq('id', adId);
    if (updateError) {
      return res.status(500).json({ error: `Database error: ${updateError.message}` });
    }
    return res.status(200).json({ adId, status: 'rejected', reviewedAt });
  }

  const { data: cards, error: cardsError } = await supabase
    .from('ad_review_cards')
    .select('result')
    .eq('ad_id', adId);
  if (cardsError) {
    return res.status(500).json({ error: `Database error: ${cardsError.message}` });
  }

  const qualityScore = computeQualityScore(cards || []);
  const finalRankScore = computeFinalRank(ad.bid_amount, qualityScore);

  const { error: approveError } = await supabase
    .from('ads')
    .update({
      status: 'approved',
      reviewer_id: reviewerId,
      reviewed_at: reviewedAt,
      quality_score: qualityScore
    })
    .eq('id', adId);
  if (approveError) {
    return res.status(500).json({ error: `Database error: ${approveError.message}` });
  }

  const bumpResult = await assignSlot(adId, finalRankScore, ad.submitted_at);

  return res.status(200).json({
    adId,
    status: 'approved',
    reviewedAt,
    auctionEntry: {
      slotId: bumpResult.slotId,
      finalRankScore,
      bumped: bumpResult.bumped
    }
  });
});

async function assignSlot(adId, finalRankScore, submittedAt) {
  const { data: slots, error: slotsError } = await supabase
    .from('auction_slots')
    .select('id, ad_id, final_rank_score');
  if (slotsError) throw new Error(slotsError.message);

  const emptySlot = slots.find((s) => !s.ad_id);
  if (emptySlot) {
    await supabase
      .from('auction_slots')
      .update({ ad_id: adId, final_rank_score: finalRankScore })
      .eq('id', emptySlot.id);
    await supabase.from('ads').update({ slot_id: emptySlot.id }).eq('id', adId);
    return { slotId: emptySlot.id, bumped: null };
  }

  const weakest = slots.reduce((min, s) => (s.final_rank_score < min.final_rank_score ? s : min));

  if (finalRankScore < weakest.final_rank_score) {
    return { slotId: null, bumped: null };
  }
  if (finalRankScore === weakest.final_rank_score) {
    const { data: weakestAd } = await supabase
      .from('ads')
      .select('submitted_at')
      .eq('id', weakest.ad_id)
      .maybeSingle();
    if (weakestAd && weakestAd.submitted_at <= submittedAt) {
      return { slotId: null, bumped: null };
    }
  }

  const bumpedAdId = weakest.ad_id;
  await supabase.from('ads').update({ slot_id: null }).eq('id', bumpedAdId);
  await supabase
    .from('auction_slots')
    .update({ ad_id: adId, final_rank_score: finalRankScore })
    .eq('id', weakest.id);
  await supabase.from('ads').update({ slot_id: weakest.id }).eq('id', adId);

  return {
    slotId: weakest.id,
    bumped: { adId: bumpedAdId, reason: "Approved, but currently not ranked in a slot, a stronger ad took its place." }
  };
}

// GET /api/ads/:adId — sec 4.3
router.get('/:adId', async (req, res) => {
  const { adId } = req.params;

  const { data: ad, error: adError } = await supabase
    .from('ads')
    .select('*')
    .eq('id', adId)
    .maybeSingle();

  if (adError) {
    return res.status(500).json({ error: `Database error: ${adError.message}` });
  }
  if (!ad) {
    return res.status(404).json({ error: `No ad found with id ${adId}.` });
  }

  const { data: cards, error: cardsError } = await supabase
    .from('ad_review_cards')
    .select('rule_name, result, reason, severity')
    .eq('ad_id', adId);

  if (cardsError) {
    return res.status(500).json({ error: `Database error: ${cardsError.message}` });
  }

  return res.status(200).json({
    adId: ad.id,
    headline: ad.headline,
    mediaUrl: ad.media_url,
    bidAmount: ad.bid_amount,
    status: ad.status,
    reviewCards: cards.map((c) => ({
      ruleName: c.rule_name,
      result: c.result,
      reason: c.reason,
      severity: c.severity
    }))
  });
});

// GET /api/ads — sec 4.2
router.get('/', async (req, res) => {
  const { status } = req.query;
  const validStatuses = ['pending', 'approved', 'rejected'];

  if (status && !validStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid status filter. Must be one of: ${validStatuses.join(', ')}.` });
  }

  let query = supabase.from('ads').select('id, headline, status, bid_amount, submitted_at');
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) {
    return res.status(500).json({ error: `Database error: ${error.message}` });
  }

  return res.status(200).json({
    ads: data.map((a) => ({
      adId: a.id,
      headline: a.headline,
      status: a.status,
      bidAmount: a.bid_amount,
      submittedAt: a.submitted_at
    }))
  });
});

module.exports = router;
