export type State = Record<string, unknown>;
export interface Delta { set?: State; del?: string[] }
export interface Line extends Delta { t: string; k?: 1; v?: State }

/** Deep copy with object keys sorted, so equal values stringify identically. */
export function sorted(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sorted);
  if (v && typeof v === "object") {
    return Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, x]) => [k, sorted(x)]));
  }
  return v;
}
const same = (a: unknown, b: unknown) => JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));

export function diff(prev: State, next: State): Delta | null {
  const set: State = {};
  for (const [k, v] of Object.entries(next)) if (!(k in prev) || !same(prev[k], v)) set[k] = v;
  const del = Object.keys(prev).filter((k) => !(k in next));
  const hasSet = Object.keys(set).length > 0;
  if (!hasSet && !del.length) return null;
  return { ...(hasSet && { set }), ...(del.length && { del }) };
}

/** State at `upTo` (default: end of file). Lines must start with a keyframe. */
export function replay(lines: Line[], upTo?: string): State {
  let s: State = {};
  for (const l of lines) {
    if (upTo !== undefined && l.t > upTo) break;
    if (l.k) s = { ...l.v };
    else {
      Object.assign(s, l.set);
      for (const k of l.del ?? []) delete s[k];
    }
  }
  return s;
}
