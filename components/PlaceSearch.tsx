"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { usePlaceSearch } from "@/hooks/usePlaceSearch";
import {
  MIN_QUERY_LENGTH,
  formatPopulation,
  normalizeQuery,
  type Place,
} from "@/lib/places";
import { CloseIcon, PinIcon, SearchIcon } from "./icons";
import styles from "./PlaceSearch.module.css";

const DEBOUNCE_MS = 250;

type PlaceSearchProps = {
  label?: string;
  examples?: string[];
  onSelect?: (place: Place) => void;
};

export function PlaceSearch({
  label = "City or town",
  examples = [],
  onSelect,
}: PlaceSearchProps) {
  const id = useId();
  const inputId = `${id}-input`;
  const listboxId = `${id}-listbox`;
  const optionId = (place: Place) => `${id}-option-${place.id}`;

  const inputRef = useRef<HTMLInputElement>(null);
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
  const showSkeleton = showPopup && status === "loading" && !places.length;
  const showPanel = showList || showSkeleton || showEmpty || showError;

  // Tracking the active option by id rather than index means a new result
  // list can't leave the highlight pointing at the wrong place.
  const activeIndex = places.findIndex((place) => place.id === activeId);
  const activePlace = showList ? places[activeIndex] : undefined;
  const activeOptionId = activePlace ? optionId(activePlace) : undefined;

  useEffect(() => {
    if (activeOptionId) {
      document
        .getElementById(activeOptionId)
        ?.scrollIntoView({ block: "nearest" });
    }
  }, [activeOptionId]);

  function select(place: Place) {
    setInput(place.name);
    setIsOpen(false);
    setActiveId(null);
    onSelect?.(place);
  }

  function search(value: string) {
    setInput(value);
    setIsOpen(true);
    setActiveId(null);
    inputRef.current?.focus();
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
  if (showSkeleton) {
    announcement = "Searching";
  } else if (showList && !isBusy) {
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
        <PinIcon className={styles.fieldIcon} />
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          className={styles.input}
          value={input}
          placeholder="City or town, e.g. Lagos"
          autoComplete="off"
          spellCheck={false}
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={listboxId}
          aria-activedescendant={activeOptionId}
          onChange={(event) => {
            setInput(event.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
        />
        <div className={styles.adornments}>
          {isBusy && <span className={styles.spinner} aria-hidden="true" />}
          {input && (
            <button
              type="button"
              className={styles.clear}
              aria-label="Clear search"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => search("")}
            >
              <CloseIcon width={18} height={18} />
            </button>
          )}
        </div>
      </div>

      <div className={styles.examples}>
        <span className={styles.examplesLabel}>Popular</span>
        {examples.map((example) => (
          <button
            key={example}
            type="button"
            className={styles.example}
            onClick={() => search(example)}
          >
            {example}
          </button>
        ))}
      </div>

      <div className={styles.panel} hidden={!showPanel}>
        {isBusy && showList && (
          <div className={styles.progress} aria-hidden="true" />
        )}

        <ul
          id={listboxId}
          role="listbox"
          aria-label="Suggestions"
          aria-busy={isBusy}
          className={styles.listbox}
          hidden={!showList}
        >
          {places.map((place) => {
            const population = formatPopulation(place.population);
            return (
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
                <PinIcon className={styles.optionIcon} />
                <span className={styles.optionText}>
                  <span className={styles.name}>
                    <HighlightMatch text={place.name} query={input} />
                  </span>
                  <span className={styles.meta}>
                    {[place.region, place.country].filter(Boolean).join(", ")}
                  </span>
                </span>
                {population && (
                  <span className={styles.population}>
                    {population}
                    <span className={styles.visuallyHidden}> people</span>
                  </span>
                )}
              </li>
            );
          })}
        </ul>

        {showSkeleton && (
          <div aria-hidden="true">
            {[0, 1, 2].map((row) => (
              <div key={row} className={styles.skeletonRow}>
                <span className={styles.skeletonIcon} />
                <span className={styles.skeletonText}>
                  <span className={styles.skeletonLine} />
                  <span className={styles.skeletonLineShort} />
                </span>
              </div>
            ))}
          </div>
        )}

        {showEmpty && (
          <div className={styles.state}>
            <SearchIcon className={styles.stateIcon} />
            <div>
              <p className={styles.stateTitle}>
                No places match &ldquo;{debouncedInput.trim()}&rdquo;
              </p>
              <p className={styles.stateHint}>
                Check the spelling or try a nearby town.
              </p>
            </div>
          </div>
        )}

        {showError && (
          <div className={`${styles.state} ${styles.error}`}>
            <p className={styles.stateTitle}>Couldn&apos;t load places.</p>
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
      </div>

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
