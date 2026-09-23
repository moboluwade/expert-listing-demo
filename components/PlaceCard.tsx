import { formatPopulation, type Place } from "@/lib/places";
import styles from "./PlaceCard.module.css";

const MAP_SPAN_DEGREES = 0.05;

export function PlaceCard({ place }: { place: Place }) {
  const { name, latitude: lat, longitude: lon } = place;
  const bbox = [
    lon - MAP_SPAN_DEGREES,
    lat - MAP_SPAN_DEGREES,
    lon + MAP_SPAN_DEGREES,
    lat + MAP_SPAN_DEGREES,
  ].join(",");
  const embedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lon}`;
  const fullMapUrl = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=13/${lat}/${lon}`;

  const stats = [
    { label: "Region", value: place.region },
    { label: "Population", value: formatPopulation(place.population) },
    { label: "Coordinates", value: `${lat.toFixed(4)}, ${lon.toFixed(4)}` },
  ];

  return (
    <section className={styles.card} aria-labelledby="place-card-title">
      <iframe
        key={place.id}
        className={styles.map}
        src={embedUrl}
        title={`Map of ${name}`}
        loading="lazy"
      />
      <div className={styles.body}>
        <div className={styles.heading}>
          <h2 id="place-card-title" className={styles.name}>
            {name}
          </h2>
          {place.country && (
            <span className={styles.country}>{place.country}</span>
          )}
        </div>

        <dl className={styles.stats}>
          {stats.map(({ label, value }) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value ?? "Not listed"}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
