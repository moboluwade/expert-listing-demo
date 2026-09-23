export const MIN_QUERY_LENGTH = 2;
export const MAX_QUERY_LENGTH = 100;

export type Place = {
  id: number;
  name: string;
  region: string | null;
  country: string;
  countryCode: string;
  latitude: number;
  longitude: number;
};

export type PlacesResponse = { places: Place[] };

type OpenMeteoResult = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  country_code?: string;
  admin1?: string;
};

// Open-Meteo omits `results` entirely when nothing matches.
export type OpenMeteoResponse = { results?: OpenMeteoResult[] };

export function normalizeQuery(query: string) {
  return query.trim().toLowerCase();
}

export function toPlaces(data: OpenMeteoResponse): Place[] {
  return (data.results ?? []).map((result) => ({
    id: result.id,
    name: result.name,
    region: result.admin1 ?? null,
    country: result.country ?? "",
    countryCode: result.country_code ?? "",
    latitude: result.latitude,
    longitude: result.longitude,
  }));
}
