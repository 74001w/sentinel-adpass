const express = require('express');
const router = express.Router();

const supabase = require('../db/supabaseClient');
const { validateAdSubmission } = require('../validators/adValidator');
const { checkBidRange, checkImageDimensions } = require('../checks/deterministicChecks');
const { runAiPolicyReview } = require('../services/aiReviewService');

function nextAdId(sequenceNumber) {
  return `AD-${String(sequenceNumber).padStart(3, '0')}`;
}

// POST /api/ads — sec 4.1
router.post('/', async (req, res) => {
  const { headline, mediaUrl, bidAmount } = req.body || {};

  const validationError = validateAdSubmission({ headline, mediaUrl, bidAmount });
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  // Determine the next sequential ad ID
  const { count, error: countError } = await supabase
    .from('ads')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    return res.status(500).json({ error: `Database error: ${countError.message}` });
  }

  const adId = nextAdId((count || 0) + 1);
  const submittedAt = new Date().toISOString();

  // Insert the ad as pending before running any review
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

  // Run deterministic checks + real AI review together
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

  // sec 5.2 / 4.1 503 case: never silently approve or drop, hold pending for manual review
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
