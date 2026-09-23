import { describe, expect, it } from "vitest";
import { normalizeQuery, toPlaces } from "@/lib/places";

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

describe("normalizeQuery", () => {
  it("trims and lowercases", () => {
    expect(normalizeQuery("  LaGos ")).toBe("lagos");
  });
});
