const sizeOf = require('image-size');

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

// Per PRD sec 5.2, this reads the media's actual width and height directly
// by fetching the file and measuring the real pixel dimensions.
async function checkImageDimensions(mediaUrl) {
  try {
    const response = await fetch(mediaUrl);
    if (!response.ok) {
      throw new Error(`request failed with status ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const dimensions = sizeOf(buffer);

    const widthOk = Math.abs(dimensions.width - IMAGE_WIDTH) <= IMAGE_TOLERANCE;
    const heightOk = Math.abs(dimensions.height - IMAGE_HEIGHT) <= IMAGE_TOLERANCE;
    const pass = widthOk && heightOk;

    return {
      ruleName: 'Image dimension check',
      result: pass ? 'pass' : 'fail',
      reason: pass
        ? `Image is ${dimensions.width}x${dimensions.height}px, within tolerance of the required ${IMAGE_WIDTH}x${IMAGE_HEIGHT}px.`
        : `Image is ${dimensions.width}x${dimensions.height}px, outside the allowed ${IMAGE_WIDTH}x${IMAGE_HEIGHT}px (±${IMAGE_TOLERANCE}px) size.`,
      severity: 'normal'
    };
  } catch (err) {
    return {
      ruleName: 'Image dimension check',
      result: 'fail',
      reason: `Could not read image dimensions from the provided URL (${err.message}).`,
      severity: 'normal'
    };
  }
}

module.exports = { checkBidRange, checkImageDimensions };
