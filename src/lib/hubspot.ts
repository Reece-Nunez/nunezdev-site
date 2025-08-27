// lib/hubspot.ts
const HS_BASE = "https://api.hubapi.com";

export type HSListResp<T> = {
  results: T[];
  paging?: { next?: { after: string } };
};

export async function hsGet<T>(
  path: string,
  query?: Record<string, string | undefined>
): Promise<T> {
  const token = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
  if (!token) {
    throw new Error("Missing HUBSPOT_PRIVATE_APP_TOKEN");
  }

  const url = new URL(HS_BASE + path);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v != null) url.searchParams.set(k, v);
    }
  }

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    // DO NOT set Content-Type on GET
  });

  if (!res.ok) {
    const text = await res.text(); // return HubSpot’s JSON/message verbatim
    throw new Error(`HubSpot ${path} ${res.status}: ${text}`);
  }

  return (await res.json()) as T;
}
