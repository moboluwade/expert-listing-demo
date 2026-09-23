import type { NextRequest } from "next/server";
import {
  MAX_QUERY_LENGTH,
  MIN_QUERY_LENGTH,
  normalizeQuery,
  rankPlaces,
  toPlaces,
  type Place,
  type PlacesResponse,
} from "@/lib/places";

const UPSTREAM_URL = "https://geocoding-api.open-meteo.com/v1/search";
const UPSTREAM_TIMEOUT_MS = 5000;
const RESULT_LIMIT = 8;
const PREFERRED_COUNTRY = "NG";
const LOCAL_POOL_SIZE = 20;
const GLOBAL_POOL_SIZE = 10;

async function searchUpstream(
  query: string,
  count: number,
  countryCode?: string,
) {
  const url = new URL(UPSTREAM_URL);
  url.searchParams.set("name", query);
  url.searchParams.set("count", String(count));
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");
  if (countryCode) url.searchParams.set("countryCode", countryCode);

  const response = await fetch(url, {
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Upstream responded ${response.status}`);
  return toPlaces(await response.json());
}

function valueOrEmpty(result: PromiseSettledResult<Place[]>) {
  return result.status === "fulfilled" ? result.value : [];
}

export async function GET(request: NextRequest) {
  const query = normalizeQuery(request.nextUrl.searchParams.get("q") ?? "");

  if (query.length > MAX_QUERY_LENGTH) {
    return Response.json({ error: "Query is too long" }, { status: 400 });
  }
  if (query.length < MIN_QUERY_LENGTH) {
    return Response.json({ places: [] } satisfies PlacesResponse);
  }

  // Open-Meteo ranks globally, so towns like Ibadan can miss the top results
  // entirely. A second, country-filtered search brings local places into the
  // pool, and rankPlaces orders the combined list by population.
  const [local, global] = await Promise.allSettled([
    searchUpstream(query, LOCAL_POOL_SIZE, PREFERRED_COUNTRY),
    searchUpstream(query, GLOBAL_POOL_SIZE),
  ]);

  if (local.status === "rejected" && global.status === "rejected") {
    const timedOut =
      global.reason instanceof DOMException &&
      global.reason.name === "TimeoutError";
    return Response.json(
      { error: timedOut ? "Place search timed out" : "Place search failed" },
      { status: timedOut ? 504 : 502 },
    );
  }

  const places = rankPlaces([...valueOrEmpty(local), ...valueOrEmpty(global)], {
    preferredCountry: PREFERRED_COUNTRY,
    limit: RESULT_LIMIT,
  });
  const isPartial = local.status === "rejected" || global.status === "rejected";

  return Response.json({ places } satisfies PlacesResponse, {
    headers: {
      // Place names barely change, so let the CDN absorb repeat queries, but
      // don't pin a half-failed result there for a day.
      "Cache-Control": isPartial
        ? "no-store"
        : "public, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
