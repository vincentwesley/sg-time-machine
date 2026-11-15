import { describe, expect, it } from "vitest";
import { diff, replay, type Line, type State } from "../scripts/diff.ts";

describe("diff", () => {
  it("null when equal, ignoring key order", () => {
    expect(diff({ a: { x: 1, y: [1, 2] } }, { a: { y: [1, 2], x: 1 } })).toBeNull();
  });
  it("set for new/changed, del for removed; empty parts omitted", () => {
    expect(diff({ a: 1, b: 2, c: 3 }, { a: 1, b: 5, d: 4 })).toEqual({ set: { b: 5, d: 4 }, del: ["c"] });
    expect(diff({ a: 1 }, { a: 1, b: 2 })).toEqual({ set: { b: 2 } });
    expect(diff({ a: 1, b: 2 }, { a: 1 })).toEqual({ del: ["b"] });
  });
});

describe("replay", () => {
  const states: State[] = [{ a: 1, b: [1, 2] }, { a: 2, b: [1, 2], c: { n: 1 } }, { a: 2, c: { n: 1 } }, { a: 2, c: { n: 2 }, d: 0 }];
  const lines: Line[] = [{ t: "2026-01-01T00:00:00+08:00", k: 1, v: states[0] }];
  for (let i = 1; i < states.length; i++) lines.push({ t: `2026-01-01T0${i}:00:00+08:00`, ...diff(states[i - 1], states[i])! });
  it("round-trips every state", () => {
    states.forEach((s, i) => expect(replay(lines, `2026-01-01T0${i}:00:00+08:00`)).toEqual(s));
    expect(replay(lines)).toEqual(states[3]);
  });
  it("upTo before any keyframe is empty", () => {
    expect(replay(lines, "2025-12-31T00:00:00+08:00")).toEqual({});
  });
});
