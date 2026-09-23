"use client";

import { useState } from "react";
import { PlaceCard } from "@/components/PlaceCard";
import { PlaceSearch } from "@/components/PlaceSearch";
import type { Place } from "@/lib/places";
import styles from "./page.module.css";

const EXAMPLES = ["Lagos", "Ikeja", "Port Harcourt", "Enugu"];

export default function Home() {
  const [selected, setSelected] = useState<Place | null>(null);

  return (
    <>
      <header className={styles.hero}>
        <div className={styles.heroInner}>
          <h1 className={styles.title}>Where are you looking?</h1>
          <p className={styles.intro}>
            Search cities and towns across Nigeria, or the world.
          </p>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.searchCard}>
          <PlaceSearch
            label="Location"
            examples={EXAMPLES}
            onSelect={setSelected}
          />
        </div>

        <div className={styles.result}>
          {selected ? (
            <PlaceCard place={selected} />
          ) : (
            <p className={styles.hint}>
              Pick a result to preview it on the map.
            </p>
          )}
        </div>
      </main>

    </>
  );
}
