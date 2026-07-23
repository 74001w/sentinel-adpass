// Temporary mock data, matches the exact shape of GET /api/auction/results (PRD §4.5)
// Delete this file once Rob's real endpoint is live, replace with a real fetch call

const mockAuctionResults = {
  slots: [
    {
      slotId: "SLOT-1",
      adId: "AD-001",
      headline: "Refreshing Zero-Sugar Lemonade - Try It Today",
      bidAmount: 250.00,
      qualityScore: 100,
      finalRankScore: 82.0,
      reason: "Ranked #1: strong bid combined with a clean policy review."
    },
    {
      slotId: "SLOT-2",
      adId: null,
      headline: null,
      bidAmount: null,
      qualityScore: null,
      finalRankScore: null,
      reason: "Slot open, no approved ad currently ranked here."
    },
    {
      slotId: "SLOT-3",
      adId: "AD-005",
      headline: "Basic Snack Bar - Try It Today",
      bidAmount: 60.00,
      qualityScore: 70,
      finalRankScore: 65.0,
      reason: "Ranked here on a moderate bid and quality score, approved with one overridden flag."
    }
  ]
};

// Example of what a "bumped" ad looks like, per §5.4, for building that display state too
const mockBumpedAdExample = {
  adId: "AD-005",
  status: "approved",
  reason: "Approved, but currently not ranked in a slot, a stronger ad took its place."
};