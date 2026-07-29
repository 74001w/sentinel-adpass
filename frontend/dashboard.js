function renderSlots(data) {
  const container = document.getElementById("slots-container");
  container.innerHTML = "";

  data.slots.forEach((slot) => {
    const card = document.createElement("div");
    card.className = "slot-card";

    if (!slot.adId) {
      card.innerHTML = `
        <h3>${slot.slotId}</h3>
        <p class="empty">${slot.reason}</p>
      `;
    } else {
      card.innerHTML = `
        <h3>${slot.slotId}</h3>
        <p class="headline">${slot.headline}</p>
        <p>Bid: $${slot.bidAmount.toFixed(2)}</p>
        <p>Quality Score: ${slot.qualityScore}</p>
        <p>Final Rank Score: ${slot.finalRankScore}</p>
        <p class="reason">${slot.reason}</p>
      `;
    }

    container.appendChild(card);
  });
}

// Rejected Bids — PRD sec 10.5, display-only, uses the existing
// GET /api/ads?status=rejected endpoint, no new backend work required.
function renderRejected(data) {
  const container = document.getElementById("rejected-container");
  container.innerHTML = "";

  if (!data.ads || data.ads.length === 0) {
    container.innerHTML = `<p class="empty">No rejected ads yet.</p>`;
    return;
  }

  data.ads.forEach((ad) => {
    const card = document.createElement("div");
    card.className = "slot-card";
    card.innerHTML = `
      <h3>${ad.adId}</h3>
      <p class="headline">${ad.headline}</p>
      <p>Bid: $${ad.bidAmount.toFixed(2)}</p>
      <p class="reason">Rejected</p>
    `;
    container.appendChild(card);
  });
}

fetch("/api/auction/results")
  .then((r) => r.json())
  .then(renderSlots);

fetch("/api/ads?status=rejected")
  .then((r) => r.json())
  .then(renderRejected);