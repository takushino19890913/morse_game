export function overlapAmount(startA, endA, startB, endB) {
  return Math.max(0, Math.min(endA, endB) - Math.max(startA, startB));
}

export function getRenderedNoteRect(note, elapsed, judgeX, speedPxPerMs) {
  const left = judgeX + (note.hitStart - elapsed) * speedPxPerMs;
  const width = Math.max(note.duration * speedPxPerMs, note.kind === "dot" ? 54 : 92);
  return { left, width, right: left + width };
}

export function judgeSingleNote(note, intervals, unitMs) {
  const inside = intervals.reduce((sum, interval) => {
    return sum + overlapAmount(note.hitStart, note.hitEnd, interval.start, interval.end);
  }, 0);

  const coverage = inside / Math.max(note.duration, 1);

  if (note.kind === "dot") {
    if (coverage >= 0.68) return { judgment: "perfect" };
    if (inside >= Math.max(55, note.duration * 0.18)) return { judgment: "good" };
    return { judgment: "miss" };
  }

  if (coverage >= 0.72) return { judgment: "perfect" };
  if (inside >= Math.max(unitMs * 0.45, note.duration * 0.18)) return { judgment: "good" };
  return { judgment: "miss" };
}

export function buildScoreState(counts, total) {
  const judged = counts.perfect + counts.good + counts.miss;
  const score = judged > 0 ? Math.round((counts.perfect * 100 + counts.good * 65) / judged) : 0;
  return { ...counts, judged, total, score };
}

export function canStartPlayerPress(sessionMode, pressStartAt) {
  return sessionMode === "running" && pressStartAt == null;
}

export function canEndPlayerPress(sessionMode, pressStartAt) {
  return sessionMode === "running" && pressStartAt != null;
}
