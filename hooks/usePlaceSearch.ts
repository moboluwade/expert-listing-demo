import { useEffect, useState } from "react";
import {
  MIN_QUERY_LENGTH,
  normalizeQuery,
  type Place,
  type PlacesResponse,
} from "@/lib/places";

const CACHE_LIMIT = 50;

export type SearchStatus = "idle" | "loading" | "success" | "error";

type SearchResult = {
  status: SearchStatus;
  places: Place[];
  retry: () => void;
};

const NO_PLACES: Place[] = [];

export function usePlaceSearch(query: string): SearchResult {
  const key = normalizeQuery(query);
  // Doubles as the cache: a query already seen is answered without a request.
  const [results, setResults] = useState(() => new Map<string, Place[]>());
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const cached = results.get(key);
  const isSearchable = key.length >= MIN_QUERY_LENGTH;

  useEffect(() => {
    if (!isSearchable || cached) return;

    const controller = new AbortController();

    fetch(`/api/places?q=${encodeURIComponent(key)}`, {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<PlacesResponse>;
      })
      .then(({ places }) => {
        // A response can resolve after the query has moved on, even when the
        // abort came too late to cancel the request itself.
        if (controller.signal.aborted) return;
        setResults((prev) => {
          const next = new Map(prev).set(key, places);
          const oldest = next.keys().next().value;
          if (next.size > CACHE_LIMIT && oldest !== undefined) {
            next.delete(oldest);
          }
          return next;
        });
        setFailedKey(null);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setFailedKey(key);
      });

    return () => controller.abort();
  }, [key, isSearchable, cached, attempt]);

  function retry() {
    setFailedKey(null);
    setAttempt((n) => n + 1);
  }

  if (!isSearchable) return { status: "idle", places: NO_PLACES, retry };
  if (cached) return { status: "success", places: cached, retry };
  if (failedKey === key) return { status: "error", places: NO_PLACES, retry };
  return { status: "loading", places: findPrefixResults(results, key), retry };
}

// While "lago" loads, the results for "lag" are a reasonable placeholder and
// stop the list flashing empty on every keystroke.
function findPrefixResults(results: Map<string, Place[]>, key: string) {
  let best = "";
  for (const cachedKey of results.keys()) {
    if (key.startsWith(cachedKey) && cachedKey.length > best.length) {
      best = cachedKey;
    }
  }
  return results.get(best) ?? NO_PLACES;
}
