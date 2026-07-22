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

// TEMPORARY: using mock data. Once Rob's GET /api/auction/results is live,
// replace this with:
// fetch("/api/auction/results").then(r => r.json()).then(renderSlots);
renderSlots(mockAuctionResults);