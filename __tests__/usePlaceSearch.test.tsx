import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePlaceSearch } from "@/hooks/usePlaceSearch";
import { deferred, errorResponse, makePlace, placesResponse } from "./helpers";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

function renderSearch(query: string) {
  return renderHook((props: { query: string }) => usePlaceSearch(props.query), {
    initialProps: { query },
  });
}

const names = (places: { name: string }[]) => places.map((p) => p.name);

describe("usePlaceSearch", () => {
  it("stays idle and skips the request for short queries", () => {
    const { result } = renderSearch("l");

    expect(result.current.status).toBe("idle");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("aborts the previous request when the query changes", () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    const { rerender } = renderSearch("lag");

    rerender({ query: "lagos" });

    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
    expect(fetchMock.mock.calls[1][1].signal.aborted).toBe(false);
  });

  it("shows results for the latest query when responses arrive out of order", async () => {
    const lag = deferred();
    const lagos = deferred();
    fetchMock
      .mockReturnValueOnce(lag.promise)
      .mockReturnValueOnce(lagos.promise);
    const { result, rerender } = renderSearch("lag");
    rerender({ query: "lagos" });

    await act(async () =>
      lagos.resolve(placesResponse([makePlace(2, "Lagos")])),
    );
    await act(async () =>
      lag.resolve(placesResponse([makePlace(1, "Lagbaja")])),
    );

    expect(result.current.status).toBe("success");
    expect(names(result.current.places)).toEqual(["Lagos"]);
  });

  it("doesn't let a stale success clear the current query's error", async () => {
    const lag = deferred();
    fetchMock
      .mockReturnValueOnce(lag.promise)
      .mockResolvedValueOnce(errorResponse());
    const { result, rerender } = renderSearch("lag");
    rerender({ query: "lagos" });
    await waitFor(() => expect(result.current.status).toBe("error"));

    await act(async () =>
      lag.resolve(placesResponse([makePlace(1, "Lagbaja")])),
    );

    expect(result.current.status).toBe("error");
  });

  it("answers a repeated query from the cache", async () => {
    fetchMock
      .mockResolvedValueOnce(placesResponse([makePlace(1, "Lagos")]))
      .mockResolvedValueOnce(placesResponse([makePlace(2, "Lagos Island")]));
    const { result, rerender } = renderSearch("lagos");
    await waitFor(() => expect(result.current.status).toBe("success"));
    rerender({ query: "lagos i" });
    await waitFor(() => expect(result.current.status).toBe("success"));

    rerender({ query: " LAGOS" });

    expect(result.current.status).toBe("success");
    expect(names(result.current.places)).toEqual(["Lagos"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("shows cached results for a shorter prefix while loading", async () => {
    fetchMock
      .mockResolvedValueOnce(placesResponse([makePlace(1, "Lagos")]))
      .mockReturnValueOnce(new Promise(() => {}));
    const { result, rerender } = renderSearch("lag");
    await waitFor(() => expect(result.current.status).toBe("success"));

    rerender({ query: "lago" });

    expect(result.current.status).toBe("loading");
    expect(names(result.current.places)).toEqual(["Lagos"]);
  });

  it("refetches on retry after an error", async () => {
    fetchMock
      .mockResolvedValueOnce(errorResponse())
      .mockResolvedValueOnce(placesResponse([makePlace(1, "Abuja")]));
    const { result } = renderSearch("abuja");
    await waitFor(() => expect(result.current.status).toBe("error"));

    act(() => result.current.retry());

    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(names(result.current.places)).toEqual(["Abuja"]);
  });
});
