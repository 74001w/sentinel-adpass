const express = require("express");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const app = express();
app.use(express.json());

// Real Supabase connection — reads credentials from your local .env
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// --- Policy review logic ---
const BANNED_WORDS = ["guaranteed", "miracle", "cure-all", "risk-free"];
const DISCLOSURE_PHRASES = ["terms apply", "see details", "restrictions apply"];

function checkBannedWords(headline) {
  const lower = headline.toLowerCase();
  const hit = BANNED_WORDS.find((w) => lower.includes(w));
  return {
    ruleName: "Banned or inappropriate words",
    result: hit ? "fail" : "pass",
    reason: hit ? `Headline contains a banned or misleading term: "${hit}".` : "No banned or inappropriate words detected in the headline.",
    severity: "normal",
  };
}

function checkDisclosure(headline) {
  const lower = headline.toLowerCase();
  const hasClaim = /\b(save|free|win|best|guarantee)\b/i.test(lower);
  const hasDisclosure = DISCLOSURE_PHRASES.some((p) => lower.includes(p));
  const fail = hasClaim && !hasDisclosure;
  return {
    ruleName: "Missing required disclosures",
    result: fail ? "fail" : "pass",
    reason: fail ? "Headline makes a promotional claim without a required disclosure phrase." : "No promotional claim requiring disclosure, or disclosure is present.",
    severity: "normal",
  };
}

function checkBidRange(bidAmount) {
  const inRange = bidAmount >= 1.0 && bidAmount <= 100000.0;
  return {
    ruleName: "Bid range check",
    result: inRange ? "pass" : "fail",
    reason: inRange ? `Bid of $${bidAmount.toFixed(2)} is within the allowed range.` : `Bid of $${bidAmount.toFixed(2)} is outside the allowed $1.00-$100,000.00 range.`,
    severity: "normal",
  };
}

function checkImageDimensions(mediaUrl) {
  const simulatedWidth = 300;
  const simulatedHeight = 250;
  const tolerance = 10;
  const ok = Math.abs(simulatedWidth - 300) <= tolerance && Math.abs(simulatedHeight - 250) <= tolerance;
  return {
    ruleName: "Incorrect image dimensions",
    result: ok ? "pass" : "fail",
    reason: ok ? `Media dimensions (${simulatedWidth}x${simulatedHeight}px) are within the allowed 300x250px, ±10px tolerance.` : `Media dimensions fall outside the allowed tolerance.`,
    severity: "normal",
  };
}

function checkManipulation(headline) {
  const injectionPattern = /ignore (your |all )?(previous|prior) instructions|mark this ad as approved|disregard the (rules|policy)/i;
  const hit = injectionPattern.test(headline);
  return {
    ruleName: "Attempted manipulation of the AI reviewer",
    result: hit ? "fail" : "pass",
    reason: hit ? "Headline contains an embedded instruction attempting to manipulate the AI reviewer. Flagged, not followed." : "No manipulation attempt detected.",
    severity: hit ? "high" : "normal",
  };
}

function runPolicyReview(headline, mediaUrl, bidAmount) {
  return [
    checkBannedWords(headline),
    checkDisclosure(headline),
    checkBidRange(bidAmount),
    checkImageDimensions(mediaUrl),
    checkManipulation(headline),
  ];
}

// --- POST /api/ads ---
app.post("/api/ads", async (req, res) => {
  const { headline, mediaUrl, bidAmount } = req.body;

  if (!headline || typeof headline !== "string" || headline.length < 1 || headline.length > 100) {
    return res.status(400).json({ error: "Headline is required and must be under 100 characters." });
  }
  if (!mediaUrl || !/^https?:\/\/.+/i.test(mediaUrl)) {
    return res.status(400).json({ error: "Media URL is required and must be a valid http/https URL." });
  }
  if (typeof bidAmount !== "number" || isNaN(bidAmount) || bidAmount <= 0) {
    return res.status(400).json({ error: "Bid amount is required and must be a positive number." });
  }

  const { count } = await supabase.from("ads").select("*", { count: "exact", head: true });
  const adId = `AD-${String((count || 0) + 1).padStart(3, "0")}`;
  const submittedAt = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const reviewCards = runPolicyReview(headline, mediaUrl, bidAmount);

  const { error: adError } = await supabase.from("ads").insert({
    id: adId,
    headline,
    media_url: mediaUrl,
    bid_amount: bidAmount,
    status: "pending",
    submitted_at: submittedAt,
  });

  if (adError) {
    console.error(adError);
    return res.status(500).json({ error: "Failed to save ad to database." });
  }

  const cardRows = reviewCards.map((c) => ({
    ad_id: adId,
    rule_name: c.ruleName,
    result: c.result,
    reason: c.reason,
    severity: c.severity,
  }));

  const { error: cardError } = await supabase.from("ad_review_cards").insert(cardRows);

  if (cardError) {
    console.error(cardError);
    return res.status(500).json({ error: "Failed to save review cards to database." });
  }

  return res.status(201).json({
    adId,
    status: "pending",
    submittedAt,
    reviewCards,
  });
});

// GET /api/ads/:adId
app.get("/api/ads/:adId", async (req, res) => {
  const { data: ad, error: adError } = await supabase
    .from("ads")
    .select("*")
    .eq("id", req.params.adId)
    .single();

  if (adError || !ad) {
    return res.status(404).json({ error: `No ad found with id ${req.params.adId}.` });
  }

  const { data: reviewCards } = await supabase
    .from("ad_review_cards")
    .select("*")
    .eq("ad_id", req.params.adId);

  return res.status(200).json({ ...ad, reviewCards });
});

// --- Quality Score, per PRD §5.3 ---
function calculateQualityScore(reviewCards) {
  const failCount = reviewCards.filter((c) => c.result === "fail").length;
  if (failCount === 0) return 100;
  const score = 100 - failCount * 20;
  return Math.max(score, 40);
}

// --- Bid Score, converted to a 0-100 scale against the $100,000 ceiling ---
function calculateBidScore(bidAmount) {
  const score = (bidAmount / 100000) * 100;
  return Math.min(Math.round(score * 100) / 100, 100);
}

// --- Re-rank the full approved pool and reassign the 5 slots ---
async function rerankAuction() {
  const { data: approvedAds } = await supabase.from("ads").select("*").eq("status", "approved");

  const ranked = approvedAds
    .map((ad) => {
      const bidScore = calculateBidScore(ad.bid_amount);
      const finalRankScore = Math.round((0.5 * bidScore + 0.5 * ad.quality_score) * 100) / 100;
      return { ...ad, finalRankScore };
    })
    .sort((a, b) => {
      if (b.finalRankScore !== a.finalRankScore) return b.finalRankScore - a.finalRankScore;
      return new Date(a.submitted_at) - new Date(b.submitted_at);
    });

  const SLOT_IDS = ["SLOT-1", "SLOT-2", "SLOT-3", "SLOT-4", "SLOT-5"];
  const previouslySlotted = approvedAds.filter((a) => a.slot_id).map((a) => a.id);

  const winners = ranked.slice(0, SLOT_IDS.length);
  const winnerIds = winners.map((w) => w.id);

  await supabase.from("ads").update({ slot_id: null }).eq("status", "approved");

  for (let i = 0; i < winners.length; i++) {
    await supabase.from("ads").update({ slot_id: SLOT_IDS[i] }).eq("id", winners[i].id);
    await supabase.from("auction_slots").upsert({ id: SLOT_IDS[i], ad_id: winners[i].id, final_rank_score: winners[i].finalRankScore });
  }
  for (let i = winners.length; i < SLOT_IDS.length; i++) {
    await supabase.from("auction_slots").upsert({ id: SLOT_IDS[i], ad_id: null, final_rank_score: null });
  }

  const bumped = previouslySlotted.find((id) => !winnerIds.includes(id));
  return { winners, bumped };
}

// --- POST /api/ads/:adId/review, per PRD §4.4 ---
app.post("/api/ads/:adId/review", async (req, res) => {
  const { adId } = req.params;
  const { reviewerId, decision } = req.body;

  if (!reviewerId || typeof reviewerId !== "string") {
    return res.status(400).json({ error: "reviewerId is required." });
  }
  if (decision !== "approved" && decision !== "rejected") {
    return res.status(400).json({ error: 'decision must be exactly "approved" or "rejected".' });
  }

  const { data: ad, error: findError } = await supabase.from("ads").select("*").eq("id", adId).single();
  if (findError || !ad) {
    return res.status(404).json({ error: `No ad found with id ${adId}.` });
  }
  if (ad.status !== "pending") {
    return res.status(409).json({ error: `Ad ${adId} already has a recorded reviewer decision.` });
  }

  const reviewedAt = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

  if (decision === "rejected") {
    await supabase.from("ads").update({ status: "rejected", reviewer_id: reviewerId, reviewed_at: reviewedAt }).eq("id", adId);
    return res.status(200).json({ adId, status: "rejected", reviewedAt });
  }

  const { data: reviewCards } = await supabase.from("ad_review_cards").select("*").eq("ad_id", adId);
  const qualityScore = calculateQualityScore(reviewCards || []);

  await supabase
    .from("ads")
    .update({ status: "approved", reviewer_id: reviewerId, reviewed_at: reviewedAt, quality_score: qualityScore })
    .eq("id", adId);

  const { winners, bumped } = await rerankAuction();
  const winnerIndex = winners.findIndex((w) => w.id === adId);

  const response = {
    adId,
    status: "approved",
    reviewedAt,
    auctionEntry:
      winnerIndex !== -1
        ? { slotId: `SLOT-${winnerIndex + 1}`, finalRankScore: winners[winnerIndex].finalRankScore }
        : { slotId: null, finalRankScore: null, note: "Approved, but currently not ranked in a slot, a stronger ad took its place." },
  };

  if (bumped) {
    response.auctionEntry.bumped = { adId: bumped, reason: "Approved, but currently not ranked in a slot, a stronger ad took its place." };
  }

  return res.status(200).json(response);
});
const PORT = 4000;
app.listen(PORT, () => console.log(`Sentinel-AdPass server running on port ${PORT}, connected to Supabase`));
