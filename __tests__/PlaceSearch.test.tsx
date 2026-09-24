import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlaceSearch } from "@/components/PlaceSearch";
import { errorResponse, makePlace, placesResponse } from "./helpers";

const fetchMock = vi.fn();

const PLACES = [
  makePlace(1, "Abeokuta"),
  makePlace(2, "Aba"),
  makePlace(3, "Abuja"),
];

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("PlaceSearch", () => {
  it("waits for typing to pause before sending one request", async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue(placesResponse(PLACES));
    render(<PlaceSearch />);
    const input = screen.getByRole("combobox");

    for (const value of ["la", "lag", "lago", "lagos"]) {
      fireEvent.change(input, { target: { value } });
      act(() => vi.advanceTimersByTime(100));
    }
    act(() => vi.advanceTimersByTime(149));
    expect(fetchMock).not.toHaveBeenCalled();

    await act(async () => vi.advanceTimersByTime(1));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/places?q=lagos");
  });

  it("only keeps old results up while the new query extends them", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(async (url: string) =>
      placesResponse(
        url.includes("kaduna")
          ? [makePlace(7, "Kaduna")]
          : [makePlace(5, "Lagos")],
      ),
    );
    render(<PlaceSearch />);
    const input = screen.getByRole("combobox");
    const typeAndWait = async (value: string) => {
      fireEvent.change(input, { target: { value } });
      await act(async () => vi.advanceTimersByTime(250));
    };
    await typeAndWait("lagos");

    fireEvent.change(input, { target: { value: "lagos i" } });
    expect(screen.getByRole("option", { name: /Lagos/ })).toBeVisible();

    fireEvent.change(input, { target: { value: "kaduna" } });
    expect(screen.queryByRole("option", { name: /Lagos/ })).toBeNull();

    await act(async () => vi.advanceTimersByTime(250));
    expect(screen.getByRole("option", { name: /Kaduna/ })).toBeVisible();
  });

  it("moves through options with the arrow keys and selects with Enter", async () => {
    fetchMock.mockResolvedValue(placesResponse(PLACES));
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<PlaceSearch onSelect={onSelect} />);
    const input = screen.getByRole("combobox");

    await user.type(input, "ab");
    const options = await screen.findAllByRole("option");
    expect(input).toHaveAttribute("aria-expanded", "true");

    await user.keyboard("{ArrowDown}");
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    expect(input).toHaveAttribute("aria-activedescendant", options[0].id);

    await user.keyboard("{ArrowUp}");
    expect(options[2]).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledWith(PLACES[2]);
    expect(input).toHaveValue("Abuja");
    expect(input).toHaveAttribute("aria-expanded", "false");
  });

  it("shows a place's population when it's known", async () => {
    fetchMock.mockResolvedValue(
      placesResponse([makePlace(5, "Lagos", { population: 15_388_000 })]),
    );
    const user = userEvent.setup();
    render(<PlaceSearch />);

    await user.type(screen.getByRole("combobox"), "lagos");

    expect(await screen.findByRole("option")).toHaveTextContent("15.4M people");
  });

  it("closes on the first Escape and clears on the second", async () => {
    fetchMock.mockResolvedValue(placesResponse(PLACES));
    const user = userEvent.setup();
    render(<PlaceSearch />);
    const input = screen.getByRole("combobox");
    await user.type(input, "ab");
    await screen.findAllByRole("option");

    await user.keyboard("{Escape}");
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(input).toHaveValue("ab");

    await user.keyboard("{Escape}");
    expect(input).toHaveValue("");
  });

  it("tells the user when nothing matches", async () => {
    fetchMock.mockResolvedValue(placesResponse([]));
    const user = userEvent.setup();
    render(<PlaceSearch />);

    await user.type(screen.getByRole("combobox"), "zzqx");

    expect(await screen.findByText("No places match “zzqx”")).toBeVisible();
    expect(screen.getByText("No results")).toBeInTheDocument();
  });

  it("shows an error and recovers on retry", async () => {
    fetchMock
      .mockResolvedValueOnce(errorResponse())
      .mockResolvedValueOnce(placesResponse([makePlace(3, "Abuja")]));
    const user = userEvent.setup();
    render(<PlaceSearch />);

    await user.type(screen.getByRole("combobox"), "abuja");
    await user.click(await screen.findByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("option", { name: /Abuja/ })).toBeVisible();
    expect(screen.queryByText("Couldn't load places.")).not.toBeInTheDocument();
  });

  it("searches for an example when its chip is clicked", async () => {
    fetchMock.mockResolvedValue(placesResponse([makePlace(4, "Ikeja")]));
    const user = userEvent.setup();
    render(<PlaceSearch examples={["Lagos", "Ikeja"]} />);

    await user.click(screen.getByRole("button", { name: "Ikeja" }));

    expect(screen.getByRole("combobox")).toHaveValue("Ikeja");
    expect(screen.getByRole("combobox")).toHaveFocus();
    expect(await screen.findByRole("option", { name: /Ikeja/ })).toBeVisible();
  });

  it("clears the input and keeps focus there", async () => {
    fetchMock.mockResolvedValue(placesResponse(PLACES));
    const user = userEvent.setup();
    render(<PlaceSearch />);
    const input = screen.getByRole("combobox");
    await user.type(input, "ab");

    await user.click(screen.getByRole("button", { name: "Clear search" }));

    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
  });
});
