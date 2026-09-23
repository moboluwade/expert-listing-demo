"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { usePlaceSearch } from "@/hooks/usePlaceSearch";
import { MIN_QUERY_LENGTH, normalizeQuery, type Place } from "@/lib/places";
import styles from "./PlaceSearch.module.css";

const DEBOUNCE_MS = 250;

type PlaceSearchProps = {
  label?: string;
  onSelect?: (place: Place) => void;
};

export function PlaceSearch({
  label = "City or town",
  onSelect,
}: PlaceSearchProps) {
  const id = useId();
  const inputId = `${id}-input`;
  const listboxId = `${id}-listbox`;
  const optionId = (place: Place) => `${id}-option-${place.id}`;

  const [input, setInput] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeId, setActiveId] = useState<number | null>(null);

  const debouncedInput = useDebouncedValue(input, DEBOUNCE_MS);
  const { status, places, retry } = usePlaceSearch(debouncedInput);

  const isSearchable = input.trim().length >= MIN_QUERY_LENGTH;
  const isDebouncing = normalizeQuery(input) !== normalizeQuery(debouncedInput);
  const isBusy = isSearchable && (isDebouncing || status === "loading");
  const showPopup = isOpen && isSearchable;
  const showList = showPopup && places.length > 0;
  const showEmpty =
    showPopup && !isDebouncing && status === "success" && !places.length;
  const showError = showPopup && !isDebouncing && status === "error";

  // Tracking the active option by id rather than index means a new result
  // list can't leave the highlight pointing at the wrong place.
  const activeIndex = places.findIndex((place) => place.id === activeId);
  const activePlace = showList ? places[activeIndex] : undefined;

  function select(place: Place) {
    setInput(place.name);
    setIsOpen(false);
    setActiveId(null);
    onSelect?.(place);
  }

  function moveActive(step: 1 | -1) {
    if (!places.length) return;
    const start = activeIndex === -1 && step === -1 ? 0 : activeIndex;
    const next = (start + step + places.length) % places.length;
    setActiveId(places[next].id);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (!isOpen) setIsOpen(true);
        else moveActive(1);
        break;
      case "ArrowUp":
        event.preventDefault();
        if (!isOpen) setIsOpen(true);
        else moveActive(-1);
        break;
      case "Enter":
        if (activePlace) {
          event.preventDefault();
          select(activePlace);
        } else if (showError) {
          event.preventDefault();
          retry();
        }
        break;
      case "Escape":
        if (showPopup) {
          setIsOpen(false);
        } else {
          setInput("");
        }
        setActiveId(null);
        break;
    }
  }

  let announcement = "";
  if (showList && !isBusy) {
    announcement = `${places.length} ${places.length === 1 ? "result" : "results"} available`;
  } else if (showEmpty) {
    announcement = "No results";
  } else if (showError) {
    announcement = "Search failed";
  }

  return (
    <div
      className={styles.root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsOpen(false);
        }
      }}
    >
      <label htmlFor={inputId} className={styles.label}>
        {label}
      </label>
      <div className={styles.field}>
        <input
          id={inputId}
          type="text"
          role="combobox"
          className={styles.input}
          value={input}
          placeholder="e.g. Lagos, Abuja, Ibadan"
          autoComplete="off"
          spellCheck={false}
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={listboxId}
          aria-activedescendant={
            activePlace ? optionId(activePlace) : undefined
          }
          onChange={(event) => {
            setInput(event.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
        />
        {isBusy && <span className={styles.spinner} aria-hidden="true" />}
      </div>

      <ul
        id={listboxId}
        role="listbox"
        aria-label="Suggestions"
        aria-busy={isBusy}
        className={styles.listbox}
        hidden={!showList}
      >
        {places.map((place) => (
          <li
            key={place.id}
            id={optionId(place)}
            role="option"
            aria-selected={place.id === activePlace?.id}
            className={styles.option}
            // Keep focus in the input so the blur handler doesn't close the
            // list before the click lands.
            onMouseDown={(event) => event.preventDefault()}
            onMouseMove={() => setActiveId(place.id)}
            onClick={() => select(place)}
          >
            <span className={styles.name}>
              <HighlightMatch text={place.name} query={input} />
            </span>
            <span className={styles.meta}>
              {[place.region, place.country].filter(Boolean).join(", ")}
            </span>
          </li>
        ))}
      </ul>

      {showPopup && status === "loading" && !places.length && (
        <div className={styles.message}>Searching…</div>
      )}
      {showEmpty && (
        <div className={styles.message}>
          No places match &ldquo;{debouncedInput.trim()}&rdquo;
        </div>
      )}
      {showError && (
        <div className={`${styles.message} ${styles.error}`}>
          Couldn&apos;t load places.
          <button
            type="button"
            className={styles.retry}
            onMouseDown={(event) => event.preventDefault()}
            onClick={retry}
          >
            Try again
          </button>
        </div>
      )}

      <div aria-live="polite" className={styles.visuallyHidden}>
        {announcement}
      </div>
    </div>
  );
}

function HighlightMatch({ text, query }: { text: string; query: string }) {
  const needle = normalizeQuery(query);
  const start = needle ? text.toLowerCase().indexOf(needle) : -1;
  if (start === -1) return text;

  const end = start + needle.length;
  return (
    <>
      {text.slice(0, start)}
      <mark>{text.slice(start, end)}</mark>
      {text.slice(end)}
    </>
  );
}
