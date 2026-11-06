export function rangeContains(range, score) {
  if (typeof score !== "number" || Number.isNaN(score)) return false;
  const minOk =
    range.min == null ? true : range.minInclusive === false ? score > range.min : score >= range.min;
  const maxOk =
    range.max == null ? true : range.maxInclusive === true ? score <= range.max : score < range.max;
  return minOk && maxOk;
}

export function rangesOverlap(a, b) {
  const aMin = a.min ?? -Infinity;
  const bMin = b.min ?? -Infinity;
  const aMax = a.max ?? Infinity;
  const bMax = b.max ?? Infinity;
  const aMinInc = a.min == null || a.minInclusive !== false;
  const bMinInc = b.min == null || b.minInclusive !== false;
  const aMaxInc = a.max == null || a.maxInclusive === true;
  const bMaxInc = b.max == null || b.maxInclusive === true;
  const aStartsBeforeBEnds = aMin < bMax || (aMin === bMax && aMinInc && bMaxInc);
  const bStartsBeforeAEnds = bMin < aMax || (bMin === aMax && bMinInc && aMaxInc);
  return aStartsBeforeBEnds && bStartsBeforeAEnds;
}

function span(range) {
  const min = range.min ?? -1e12;
  const max = range.max ?? 1e12;
  return max - min;
}

export function matchRange(score, ranges) {
  const hits = (ranges || []).filter((range) => rangeContains(range, score));
  if (!hits.length) return null;
  hits.sort((left, right) => right.priority - left.priority || span(left) - span(right));
  return hits[0];
}
