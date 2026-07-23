// Values pulled straight from Working PRD sec 7.3 (Exact Values & Formats)
const BID_MIN = 1.0;
const BID_MAX = 100000.0;
const IMAGE_WIDTH = 300;
const IMAGE_HEIGHT = 250;
const IMAGE_TOLERANCE = 10;

function checkBidRange(bidAmount) {
  const pass = bidAmount >= BID_MIN && bidAmount <= BID_MAX;
  return {
    ruleName: 'Bid range check',
    result: pass ? 'pass' : 'fail',
    reason: pass
      ? `Bid of $${bidAmount.toFixed(2)} is within the allowed range.`
      : `This ad's bid of $${bidAmount.toFixed(2)} is outside the allowed range of $${BID_MIN.toFixed(2)} to $${BID_MAX.toFixed(2)}.`,
    severity: 'normal'
  };
}

// Per PRD sec 5.1, the MVP does not verify a media URL points to a real,
// working file. So this check reads dimensions from the filename's own
// "-WIDTHxHEIGHT" convention (e.g. "lemonade-300x250.jpg") instead of
// fetching the actual file, no network request needed.
function checkImageDimensions(mediaUrl) {
  const match = mediaUrl.match(/-(\d+)x(\d+)\.\w+(\?.*)?$/i);

  if (!match) {
    return {
      ruleName: 'Image dimension check',
      result: 'fail',
      reason: `Could not determine dimensions from the media URL, expected a "-WIDTHxHEIGHT" filename pattern (e.g. "-300x250.jpg").`,
      severity: 'normal'
    };
  }

  const width = parseInt(match[1], 10);
  const height = parseInt(match[2], 10);
  const widthOk = Math.abs(width - IMAGE_WIDTH) <= IMAGE_TOLERANCE;
  const heightOk = Math.abs(height - IMAGE_HEIGHT) <= IMAGE_TOLERANCE;
  const pass = widthOk && heightOk;

  return {
    ruleName: 'Image dimension check',
    result: pass ? 'pass' : 'fail',
    reason: pass
      ? `Media is ${width}x${height}px, within tolerance of the required ${IMAGE_WIDTH}x${IMAGE_HEIGHT}px.`
      : `Media is ${width}x${height}px, outside the allowed ${IMAGE_WIDTH}x${IMAGE_HEIGHT}px (±${IMAGE_TOLERANCE}px) size.`,
    severity: 'normal'
  };
}

module.exports = { checkBidRange, checkImageDimensions };
