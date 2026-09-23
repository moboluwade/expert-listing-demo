# Place search

A typeahead for cities and towns, built for the Expert Listing frontend screening task. It queries the [Open-Meteo geocoding API](https://open-meteo.com/en/docs/geocoding-api) as you type. No API key is needed.

Live demo: TODO

## Running it

Needs Node 20.9 or later.

```
npm install
npm run dev     # http://localhost:3000
npm test
```

## How it's put together

- `app/api/places/route.ts` proxies Open-Meteo and sets CDN cache headers. It runs a global search and a Nigeria-only search in parallel, since a global ranking can leave towns like Ibadan out of the top results, then ranks the combined pool by population with a boost for Nigerian places.
- `lib/places.ts` has the `Place` type, the normalisation (including dropping duplicate GeoNames rows) and the ranking.
- `hooks/usePlaceSearch.ts` handles fetching, cancellation, the stale-response guard and a small in-memory cache.
- `hooks/useDebouncedValue.ts` delays the query until typing pauses (250ms).
- `components/PlaceSearch.tsx` is the combobox itself, following the WAI-ARIA combobox pattern.
- `components/PlaceCard.tsx` shows the selected place with an OpenStreetMap embed.

The styling follows Expert Listing's palette (deep green, lime, rounded cards) so the component looks at home in their product. Place data comes from Open-Meteo (CC BY 4.0) and maps from OpenStreetMap contributors.

- `__tests__/` covers the normalisation, the ranking, the route, the hook's race conditions and the component's keyboard and states.

Keyboard: up and down arrows move through results, Enter selects, Escape closes the list and a second Escape clears the input.