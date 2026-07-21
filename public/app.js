(() => {
  const API_BASE = '/api/ads';

  /* ---------------- Role switching ---------------- */

  const roleButtons = document.querySelectorAll('.role-btn');
  const views = {
    advertiser: document.getElementById('view-advertiser'),
    reviewer: document.getElementById('view-reviewer')
  };

  roleButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const role = btn.dataset.role;
      roleButtons.forEach((b) => {
        b.classList.toggle('is-active', b === btn);
        b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
      });
      Object.entries(views).forEach(([key, el]) => {
        el.classList.toggle('is-active', key === role);
      });
      if (role === 'reviewer') loadQueue();
    });
  });

  /* ---------------- Shared helpers ---------------- */

  function ruleIcon(result) {
    return result === 'pass' ? '✓' : '✕';
  }

  function renderCard(card) {
    const isHigh = card.severity === 'high';
    return `
      <div class="card-stamp result-${card.result} ${isHigh ? 'severity-high' : ''}">
        <span class="card-icon">${ruleIcon(card.result)}</span>
        <div class="card-body">
          <div class="card-rule">${escapeHtml(card.ruleName)}</div>
          <div class="card-reason">${escapeHtml(card.reason)}</div>
          ${isHigh ? '<span class="card-severity-tag">⚠ High severity</span>' : ''}
        </div>
      </div>
    `;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  /* ---------------- Advertiser: submission form ---------------- */

  const form = document.getElementById('ad-form');
  const submitBtn = document.getElementById('submit-btn');
  const submitBanner = document.getElementById('submit-banner');
  const resultPanel = document.getElementById('result-panel');
  const resultAdId = document.getElementById('result-ad-id');
  const resultStatus = document.getElementById('result-status');
  const resultCards = document.getElementById('result-cards');

  function clearFieldErrors() {
    document.querySelectorAll('.field-error').forEach((el) => (el.textContent = ''));
    document.querySelectorAll('.field').forEach((el) => el.classList.remove('has-error'));
  }

  function showFieldError(fieldName, message) {
    const errorEl = document.querySelector(`[data-error-for="${fieldName}"]`);
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.closest('.field').classList.add('has-error');
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearFieldErrors();
    submitBanner.classList.add('is-hidden');
    resultPanel.hidden = true;

    const headline = document.getElementById('headline').value.trim();
    const mediaUrl = document.getElementById('mediaUrl').value.trim();
    const bidAmountRaw = document.getElementById('bidAmount').value.trim();
    const bidAmount = Number(bidAmountRaw);

    // Light client-side pre-check so obvious misses show up next to the field,
    // instantly — the server still does the real, authoritative validation below.
    let hasClientError = false;
    if (!headline || headline.length > 100) {
      showFieldError('headline', 'Headline is required and must be 1–100 characters.');
      hasClientError = true;
    }
    if (!/^https?:\/\/.+/i.test(mediaUrl)) {
      showFieldError('mediaUrl', 'Enter a valid http:// or https:// URL.');
      hasClientError = true;
    }
    if (!bidAmountRaw || !Number.isFinite(bidAmount) || bidAmount <= 0) {
      showFieldError('bidAmount', 'Enter a positive number.');
      hasClientError = true;
    }
    if (hasClientError) return;

    submitBtn.disabled = true;
    submitBtn.querySelector('.btn-label').textContent = 'Submitting…';

    try {
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ headline, mediaUrl, bidAmount })
      });

      const data = await response.json();

      if (response.status === 400) {
        submitBanner.textContent = data.error || 'Submission failed validation.';
        submitBanner.classList.remove('is-hidden');
        return;
      }

      if (!response.ok) {
        submitBanner.textContent = data.error || `Something went wrong (status ${response.status}).`;
        submitBanner.classList.remove('is-hidden');
        return;
      }

      // Success — render the real returned ad + review cards
      resultAdId.textContent = data.adId;
      resultStatus.textContent = data.status;
      resultStatus.className = `status-chip status-${data.status}`;

      if (data.note) {
        resultCards.innerHTML = `<p class="empty-state">${escapeHtml(data.note)}</p>`;
      } else {
        resultCards.innerHTML = (data.reviewCards || []).map(renderCard).join('');
      }

      resultPanel.hidden = false;
      form.reset();
    } catch (err) {
      submitBanner.textContent = `Could not reach the server: ${err.message}`;
      submitBanner.classList.remove('is-hidden');
    } finally {
      submitBtn.disabled = false;
      submitBtn.querySelector('.btn-label').textContent = 'Submit ad';
    }
  });

  /* ---------------- Reviewer: queue + detail ---------------- */

  const queueList = document.getElementById('queue-list');
  const detailPanel = document.getElementById('detail-panel');
  const refreshBtn = document.getElementById('refresh-queue');

  let selectedAdId = null;

  async function loadQueue() {
    queueList.innerHTML = '<p class="empty-state">Loading queue…</p>';
    try {
      const response = await fetch(`${API_BASE}?status=pending`);
      const data = await response.json();

      if (!response.ok) {
        queueList.innerHTML = `<p class="empty-state">${escapeHtml(data.error || 'Could not load queue.')}</p>`;
        return;
      }

      if (!data.ads || data.ads.length === 0) {
        queueList.innerHTML = '<p class="empty-state">No ads waiting for review.</p>';
        return;
      }

      queueList.innerHTML = data.ads
        .map(
          (ad) => `
        <button class="queue-item" data-ad-id="${ad.adId}">
          <span class="queue-item-id">${ad.adId}</span>
          <span class="queue-item-headline">${escapeHtml(ad.headline)}</span>
          <span class="queue-item-bid">$${Number(ad.bidAmount).toFixed(2)}</span>
        </button>
      `
        )
        .join('');

      queueList.querySelectorAll('.queue-item').forEach((btn) => {
        btn.addEventListener('click', () => selectAd(btn.dataset.adId));
      });
    } catch (err) {
      queueList.innerHTML = `<p class="empty-state">Could not reach the server: ${escapeHtml(err.message)}</p>`;
    }
  }

  async function selectAd(adId) {
    selectedAdId = adId;
    queueList.querySelectorAll('.queue-item').forEach((btn) => {
      btn.classList.toggle('is-selected', btn.dataset.adId === adId);
    });

    detailPanel.innerHTML = '<p class="empty-state">Loading ad…</p>';

    try {
      const response = await fetch(`${API_BASE}/${adId}`);
      const ad = await response.json();

      if (!response.ok) {
        detailPanel.innerHTML = `<p class="empty-state">${escapeHtml(ad.error || 'Could not load ad.')}</p>`;
        return;
      }

      const cardsHtml = (ad.reviewCards || []).map(renderCard).join('');

      detailPanel.innerHTML = `
        <div class="panel-head">
          <span class="eyebrow">${ad.adId}</span>
          <div class="detail-ad-headline">${escapeHtml(ad.headline)}</div>
          <div class="detail-ad-meta">${escapeHtml(ad.mediaUrl)} · $${Number(ad.bidAmount).toFixed(2)}</div>
        </div>
        <div class="cards">${cardsHtml || '<p class="empty-state">No review cards yet.</p>'}</div>
        <div class="decision-row">
          <button class="btn-approve" id="approve-btn">Approve</button>
          <button class="btn-reject" id="reject-btn">Reject</button>
        </div>
        <p class="field-error" id="decision-error"></p>
      `;

      document.getElementById('approve-btn').addEventListener('click', () => decide(adId, 'approved'));
      document.getElementById('reject-btn').addEventListener('click', () => decide(adId, 'rejected'));
    } catch (err) {
      detailPanel.innerHTML = `<p class="empty-state">Could not reach the server: ${escapeHtml(err.message)}</p>`;
    }
  }

  async function decide(adId, decision) {
    const approveBtn = document.getElementById('approve-btn');
    const rejectBtn = document.getElementById('reject-btn');
    const errorEl = document.getElementById('decision-error');
    approveBtn.disabled = true;
    rejectBtn.disabled = true;
    errorEl.textContent = '';

    try {
      const response = await fetch(`${API_BASE}/${adId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewerId: 'REV-01', decision })
      });
      const data = await response.json();

      if (response.status === 404) {
        // Expected until the review-decision endpoint (Rob's lane) is built.
        errorEl.textContent =
          'The review-decision endpoint (POST /api/ads/:adId/review) isn\'t built yet — this button is wired and ready for it.';
        approveBtn.disabled = false;
        rejectBtn.disabled = false;
        return;
      }

      if (!response.ok) {
        errorEl.textContent = data.error || `Something went wrong (status ${response.status}).`;
        approveBtn.disabled = false;
        rejectBtn.disabled = false;
        return;
      }

      // Success: ad is decided, drop it from the queue and clear the detail view
      loadQueue();
      detailPanel.innerHTML = '<div class="empty-state detail-empty"><p>Select an ad from the queue to review it.</p></div>';
    } catch (err) {
      errorEl.textContent = `Could not reach the server: ${err.message}`;
      approveBtn.disabled = false;
      rejectBtn.disabled = false;
    }
  }

  refreshBtn.addEventListener('click', loadQueue);
})();
