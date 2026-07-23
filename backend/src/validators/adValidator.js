// Matches Working PRD sec 5.1 (Ad Submission) and sec 4.1 (POST /api/ads).
// Note: bid amount is checked here ONLY for "is it a valid positive number."
// The $1.00-$100,000.00 RANGE is intentionally NOT enforced here — per sec 4.1,
// that's a policy check that produces a pass/fail card, not a submission-blocking error.

function validateAdSubmission({ headline, mediaUrl, bidAmount }) {
  if (typeof headline !== 'string' || headline.trim().length < 1 || headline.length > 100) {
    return 'Headline is required and must be between 1 and 100 characters.';
  }

  if (typeof mediaUrl !== 'string' || !/^https?:\/\/.+/i.test(mediaUrl.trim())) {
    return 'Media URL is required and must be a valid http:// or https:// URL.';
  }

  if (typeof bidAmount !== 'number' || !Number.isFinite(bidAmount) || bidAmount <= 0) {
    return 'Bid amount is required and must be a positive number.';
  }

  return null; // no validation error
}

module.exports = { validateAdSubmission };
