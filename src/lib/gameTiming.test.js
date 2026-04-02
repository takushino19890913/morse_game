import { describe, expect, it } from "vitest";
import { buildScoreState, canEndPlayerPress, canStartPlayerPress, judgeSingleNote } from "./gameTiming.js";

describe("gameTiming", () => {
  it("allows starting a press only while running and not already holding", () => {
    expect(canStartPlayerPress("running", null)).toBe(true);
    expect(canStartPlayerPress("running", 1234)).toBe(false);
    expect(canStartPlayerPress("idle", null)).toBe(false);
  });

  it("allows ending a press whenever a running session has an active start time", () => {
    expect(canEndPlayerPress("running", 1234)).toBe(true);
    expect(canEndPlayerPress("running", null)).toBe(false);
    expect(canEndPlayerPress("idle", 1234)).toBe(false);
  });

  it("scores partial overlaps as good for longer dashes", () => {
    const note = { kind: "dash", hitStart: 1000, hitEnd: 1360, duration: 360 };
    const result = judgeSingleNote(note, [{ start: 1080, end: 1280 }], 120);
    expect(result).toEqual({ judgment: "good" });
  });

  it("calculates score percentages from the judgment counts", () => {
    expect(buildScoreState({ perfect: 2, good: 1, miss: 1, combo: 0, maxCombo: 2 }, 4)).toMatchObject({
      judged: 4,
      score: 66,
    });
  });
});
