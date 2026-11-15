export const UA = "sg-time-machine (+https://github.com/vincentwesley/sg-time-machine)";

export interface Http {
  fetch: typeof fetch;
  pause: (ms: number) => Promise<void>;
}

export const realHttp: Http = {
  fetch: (...a) => fetch(...a),
  pause: (ms) => new Promise((r) => setTimeout(r, ms)),
};

/** GET with UA + 20 s timeout; one retry after 10 s on a network error, 429 or 5xx, then throws. */
async function get(url: string, http: Http): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    let err: Error;
    let retry = true;
    try {
      const res = await http.fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(20_000) });
      if (res.ok) return res;
      err = new Error(`HTTP ${res.status}`);
      retry = res.status === 429 || res.status >= 500;
    } catch (e) {
      err = e as Error;
    }
    if (!retry || attempt === 1) throw err;
    await http.pause(10_000);
  }
}

export const getText = async (url: string, http: Http = realHttp) => (await get(url, http)).text();
export const getJson = async (url: string, http: Http = realHttp): Promise<unknown> => (await get(url, http)).json();

/** data.gov.sg dataset download: poll-download gives a short-lived URL, then fetch the file as text. */
export async function pollDownload(id: string, http: Http = realHttp): Promise<string> {
  const j = (await getJson(`https://api-open.data.gov.sg/v1/public/api/datasets/${id}/poll-download`, http)) as {
    code?: number;
    data?: { url?: string };
  };
  if (j.code !== 0 || typeof j.data?.url !== "string") throw new Error("poll-download: no url");
  return getText(j.data.url, http);
}
