import type { NextRequest } from "next/server";
import {
  MAX_QUERY_LENGTH,
  MIN_QUERY_LENGTH,
  normalizeQuery,
  toPlaces,
  type OpenMeteoResponse,
  type PlacesResponse,
} from "@/lib/places";

const UPSTREAM_URL = "https://geocoding-api.open-meteo.com/v1/search";
const UPSTREAM_TIMEOUT_MS = 5000;
const RESULT_LIMIT = 8;

export async function GET(request: NextRequest) {
  const query = normalizeQuery(request.nextUrl.searchParams.get("q") ?? "");

  if (query.length > MAX_QUERY_LENGTH) {
    return Response.json({ error: "Query is too long" }, { status: 400 });
  }
  if (query.length < MIN_QUERY_LENGTH) {
    return Response.json({ places: [] } satisfies PlacesResponse);
  }

  const url = new URL(UPSTREAM_URL);
  url.searchParams.set("name", query);
  url.searchParams.set("count", String(RESULT_LIMIT));
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");

  try {
    const upstream = await fetch(url, {
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    if (!upstream.ok) {
      return Response.json(
        { error: "Place search is unavailable" },
        { status: 502 },
      );
    }

    const data: OpenMeteoResponse = await upstream.json();
    return Response.json({ places: toPlaces(data) } satisfies PlacesResponse, {
      headers: {
        // Place names barely change, so let the CDN absorb repeat queries.
        "Cache-Control":
          "public, s-maxage=86400, stale-while-revalidate=604800",
      },
    });
  } catch (error) {
    const timedOut =
      error instanceof DOMException && error.name === "TimeoutError";
    return Response.json(
      { error: timedOut ? "Place search timed out" : "Place search failed" },
      { status: timedOut ? 504 : 502 },
    );
  }
}
