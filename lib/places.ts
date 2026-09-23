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
  population: number | null;
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
  population?: number;
};

// Open-Meteo omits `results` entirely when nothing matches.
export type OpenMeteoResponse = { results?: OpenMeteoResult[] };

export function normalizeQuery(query: string) {
  return query.trim().toLowerCase();
}

export function toPlaces(data: OpenMeteoResponse): Place[] {
  return uniqueByLabel(
    (data.results ?? []).map((result) => ({
      id: result.id,
      name: result.name,
      region: result.admin1 ?? null,
      country: result.country ?? "",
      countryCode: result.country_code ?? "",
      latitude: result.latitude,
      longitude: result.longitude,
      population: result.population ?? null,
    })),
  );
}

// Worth two orders of magnitude of population: a Nigerian town of 250K ranks
// level with a foreign city of 25M.
const PREFERRED_COUNTRY_BOOST = 2;

export function rankPlaces(
  places: Place[],
  { preferredCountry, limit }: { preferredCountry: string; limit: number },
): Place[] {
  const score = (place: Place) =>
    Math.log10((place.population ?? 0) + 1) +
    (place.countryCode === preferredCountry ? PREFERRED_COUNTRY_BOOST : 0);

  // sort() is stable, so equal scores keep Open-Meteo's relevance order.
  return uniqueByLabel(places)
    .sort((a, b) => score(b) - score(a))
    .slice(0, limit);
}

const compactNumber = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function formatPopulation(population: number | null) {
  return population ? compactNumber.format(population) : null;
}

function uniqueByLabel(places: Place[]) {
  const seen = new Set<string>();
  return places.filter((place) => {
    // GeoNames has separate entries for villages that share a name and region,
    // which would render as identical rows.
    const label = `${place.name}|${place.region}|${place.country}`;
    if (seen.has(label)) return false;
    seen.add(label);
    return true;
  });
}
