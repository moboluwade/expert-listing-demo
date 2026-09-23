import { describe, expect, it } from "vitest";
import {
  formatPopulation,
  normalizeQuery,
  rankPlaces,
  toPlaces,
} from "@/lib/places";
import { makePlace } from "./helpers";

describe("toPlaces", () => {
  it("returns an empty list when Open-Meteo omits results", () => {
    expect(toPlaces({})).toEqual([]);
  });

  it("maps upstream fields to our Place shape", () => {
    const places = toPlaces({
      results: [
        {
          id: 2332459,
          name: "Lagos",
          latitude: 6.45407,
          longitude: 3.39467,
          country: "Nigeria",
          country_code: "NG",
          admin1: "Lagos",
          population: 15388000,
        },
      ],
    });

    expect(places).toEqual([
      {
        id: 2332459,
        name: "Lagos",
        region: "Lagos",
        country: "Nigeria",
        countryCode: "NG",
        latitude: 6.45407,
        longitude: 3.39467,
        population: 15388000,
      },
    ]);
  });

  it("drops rows that would render identically", () => {
    const row = { name: "Lag", latitude: 0, longitude: 0, country: "India" };
    const places = toPlaces({
      results: [
        { ...row, id: 1, admin1: "Himachal Pradesh" },
        { ...row, id: 2, admin1: "Himachal Pradesh" },
        { ...row, id: 3, admin1: "Punjab" },
      ],
    });

    expect(places.map((place) => place.id)).toEqual([1, 3]);
  });
});

describe("rankPlaces", () => {
  const options = { preferredCountry: "NG", limit: 8 };
  const foreign = (id: number, name: string, population: number | null) =>
    makePlace(id, name, {
      country: "Elsewhere",
      countryCode: "XX",
      population,
    });
  const ids = (places: { id: number }[]) => places.map((place) => place.id);

  it("ranks bigger places first", () => {
    const ranked = rankPlaces(
      [
        makePlace(1, "Lago", { population: null }),
        makePlace(2, "Lagos Island", { population: 212_700 }),
        makePlace(3, "Lagos", { population: 15_388_000 }),
      ],
      options,
    );

    expect(ids(ranked)).toEqual([3, 2, 1]);
  });

  it("lets a Nigerian town outrank a mid-size foreign one", () => {
    const ranked = rankPlaces(
      [
        foreign(1, "Pori", 83_157),
        makePlace(2, "Ikere-Ekiti", { population: 103_054 }),
        makePlace(3, "Ike", { population: null }),
      ],
      options,
    );

    expect(ids(ranked)).toEqual([2, 1, 3]);
  });

  it("keeps the upstream order when scores tie", () => {
    const ranked = rankPlaces(
      [makePlace(1, "Aba"), makePlace(2, "Abak"), makePlace(3, "Abaji")],
      options,
    );

    expect(ids(ranked)).toEqual([1, 2, 3]);
  });

  it("drops duplicates found by both searches and respects the limit", () => {
    const lagos = makePlace(1, "Lagos", { population: 15_388_000 });
    const pool = [
      lagos,
      ...[2, 3, 4].map((id) => foreign(id, `Lag ${id}`, null)),
      lagos,
    ];

    expect(ids(rankPlaces(pool, options))).toEqual([1, 2, 3, 4]);
    expect(rankPlaces(pool, { ...options, limit: 2 })).toHaveLength(2);
  });
});

describe("formatPopulation", () => {
  it("abbreviates large numbers", () => {
    expect(formatPopulation(15_388_000)).toBe("15.4M");
    expect(formatPopulation(212_700)).toBe("212.7K");
  });

  it("returns null when the population isn't known", () => {
    expect(formatPopulation(null)).toBeNull();
  });
});

describe("normalizeQuery", () => {
  it("trims and lowercases", () => {
    expect(normalizeQuery("  LaGos ")).toBe("lagos");
  });
});
