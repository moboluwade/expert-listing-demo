import type { Place } from "@/lib/places";

export function makePlace(
  id: number,
  name: string,
  overrides: Partial<Place> = {},
): Place {
  return {
    id,
    name,
    region: "Lagos",
    country: "Nigeria",
    countryCode: "NG",
    latitude: 6.45,
    longitude: 3.39,
    population: null,
    ...overrides,
  };
}

export function placesResponse(places: Place[]) {
  return { ok: true, status: 200, json: async () => ({ places }) };
}

export function errorResponse(status = 502) {
  return { ok: false, status, json: async () => ({ error: "failed" }) };
}

export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}
