// Auction scoring logic, kept isolated per PRD architecture notes
// so future changes (new scoring factors, different bid ceiling) touch
// only this file, not the route handlers or the schema.

const BID_FLOOR = 1.0;
const BID_CEILING = 100000.0; // demo-facing range, per sec 7.3, not a DB constraint

function computeBidScore(bidAmount) {
  const clamped = Math.max(BID_FLOOR, Math.min(bidAmount, BID_CEILING));
  return ((clamped - BID_FLOOR) / (BID_CEILING - BID_FLOOR)) * 100;
}

function computeQualityScore(reviewCards) {
  // zero flags = 100, flags overridden by the reviewer = partial credit
  const failCount = reviewCards.filter((c) => c.result === 'fail').length;
  if (failCount === 0) return 100;
  return Math.max(0, 100 - failCount * 20);
}

function computeFinalRank(bidAmount, qualityScore) {
  const bidScore = computeBidScore(bidAmount);
  return bidScore * 0.5 + qualityScore * 0.5; // 50% bid + 50% quality, locked per PRD
}

module.exports = { computeBidScore, computeQualityScore, computeFinalRank };