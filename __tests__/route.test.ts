// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/places/route";

const fetchMock = vi.fn();

function request(query: string) {
  return new NextRequest(
    `http://localhost/api/places?q=${encodeURIComponent(query)}`,
  );
}

function upstreamResult(
  id: number,
  name: string,
  countryCode: string,
  population?: number,
) {
  return {
    id,
    name,
    population,
    latitude: 0,
    longitude: 0,
    country: countryCode === "NG" ? "Nigeria" : "Elsewhere",
    country_code: countryCode,
    admin1: "Region",
  };
}

// Answers the Nigeria-filtered and global upstream searches separately.
function mockUpstream(handlers: {
  local: () => Promise<Response>;
  global: () => Promise<Response>;
}) {
  fetchMock.mockImplementation((url: URL) =>
    url.searchParams.get("countryCode") === "NG"
      ? handlers.local()
      : handlers.global(),
  );
}

const results =
  (...items: ReturnType<typeof upstreamResult>[]) =>
  () =>
    Promise.resolve(Response.json({ results: items }));

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("GET /api/places", () => {
  it("returns no places for short queries without calling upstream", async () => {
    const response = await GET(request("l"));

    expect(await response.json()).toEqual({ places: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects queries over the length limit", async () => {
    const response = await GET(request("a".repeat(101)));

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("merges both searches and ranks them by population", async () => {
    mockUpstream({
      local: results(
        upstreamResult(1, "Lago", "NG"),
        upstreamResult(2, "Lagos", "NG", 15_388_000),
      ),
      global: results(
        upstreamResult(3, "La Guaira", "VE", 25_259),
        upstreamResult(2, "Lagos", "NG", 15_388_000),
      ),
    });

    const response = await GET(request("  Lag "));
    const { places } = await response.json();
    const [localUrl] = fetchMock.mock.calls[0];

    expect(places.map((p: { name: string }) => p.name)).toEqual([
      "Lagos",
      "La Guaira",
      "Lago",
    ]);
    expect(localUrl.searchParams.get("name")).toBe("lag");
    expect(localUrl.searchParams.get("count")).toBe("20");
    expect(response.headers.get("Cache-Control")).toContain("s-maxage");
  });

  it("falls back to global results when the local search fails", async () => {
    mockUpstream({
      local: () => Promise.resolve(new Response(null, { status: 500 })),
      global: results(upstreamResult(2, "Paris", "FR")),
    });

    const response = await GET(request("paris"));

    expect(response.status).toBe(200);
    expect((await response.json()).places).toHaveLength(1);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("responds 502 when both upstream searches fail", async () => {
    mockUpstream({
      local: () => Promise.resolve(new Response(null, { status: 500 })),
      global: () => Promise.resolve(new Response(null, { status: 500 })),
    });

    const response = await GET(request("lagos"));

    expect(response.status).toBe(502);
  });

  it("responds 504 when upstream times out", async () => {
    fetchMock.mockRejectedValue(new DOMException("Timed out", "TimeoutError"));

    const response = await GET(request("lagos"));

    expect(response.status).toBe(504);
  });
});
