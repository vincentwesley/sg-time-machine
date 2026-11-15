import { readFileSync } from "node:fs";
import type { Http } from "../scripts/http.ts";

export const fixText = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
export const fix = (name: string): unknown => JSON.parse(fixText(name));
export const noPause = (log: number[] = []): Pick<Http, "pause"> => ({ pause: async (ms) => void log.push(ms) });
export const resp = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
