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

  it("returns normalised places with CDN cache headers", async () => {
    fetchMock.mockResolvedValue(
      Response.json({
        results: [
          {
            id: 1,
            name: "Lagos",
            latitude: 6.45,
            longitude: 3.39,
            country: "Nigeria",
            country_code: "NG",
            admin1: "Lagos",
          },
        ],
      }),
    );

    const response = await GET(request("  Lagos "));
    const upstreamUrl = new URL(fetchMock.mock.calls[0][0]);

    expect(upstreamUrl.searchParams.get("name")).toBe("lagos");
    expect(response.headers.get("Cache-Control")).toContain("s-maxage");
    expect(await response.json()).toEqual({
      places: [expect.objectContaining({ name: "Lagos", countryCode: "NG" })],
    });
  });

  it("responds 502 when upstream fails", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 500 }));

    const response = await GET(request("lagos"));

    expect(response.status).toBe(502);
  });

  it("responds 504 when upstream times out", async () => {
    fetchMock.mockRejectedValue(new DOMException("Timed out", "TimeoutError"));

    const response = await GET(request("lagos"));

    expect(response.status).toBe(504);
  });
});
