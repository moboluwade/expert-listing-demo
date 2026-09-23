"use client";

import { useState } from "react";
import { PlaceSearch } from "@/components/PlaceSearch";
import type { Place } from "@/lib/places";
import styles from "./page.module.css";

export default function Home() {
  const [selected, setSelected] = useState<Place | null>(null);

  return (
    <main className={styles.main}>
      <h1 className={styles.title}>Find a place</h1>
      <PlaceSearch onSelect={setSelected} />
      {selected && (
        <p className={styles.selected}>
          {[selected.name, selected.region, selected.country]
            .filter(Boolean)
            .join(", ")}{" "}
          <span className={styles.coords}>
            ({selected.latitude.toFixed(4)}, {selected.longitude.toFixed(4)})
          </span>
        </p>
      )}
    </main>
  );
}
