#!/usr/bin/env node
// Imports Travelpayouts' public airports/cities/countries reference data
// into the `airports` table (joined: airport -> city_code -> city name,
// airport -> country_code -> country name), filtered to flightable
// airports. Replaces the old "live external search on a local miss"
// design (Amadeus Locations, since removed) — comprehensive local coverage
// beats a per-keystroke external call. Safe to re-run: upserts on
// iata_code conflict.
//
// These three files are public (no Travelpayouts token needed).
//
// Usage (from apps/api/):
//   node --env-file=../../.env scripts/import-airports.mjs
// Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (see .env.example).');
  process.exit(1);
}

const BATCH_SIZE = 500;

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

// The app's UI and target users are Korean (PRD/screens are all Korean),
// so pull the `ko` locale of Travelpayouts' reference data — searching
// "인천"/"방콕" against English-only names never matches (this bit us once:
// the table was first imported with `en` data, silently breaking airport
// search for anyone typing in Korean).
const LOCALE = 'ko';

async function main() {
  console.log(`Fetching Travelpayouts reference data (airports, cities, countries; locale=${LOCALE})...`);
  const [airports, cities, countries] = await Promise.all([
    fetchJson(`https://api.travelpayouts.com/data/${LOCALE}/airports.json`),
    fetchJson(`https://api.travelpayouts.com/data/${LOCALE}/cities.json`),
    fetchJson(`https://api.travelpayouts.com/data/${LOCALE}/countries.json`),
  ]);

  // The `ko` locale doesn't have a Korean translation for every entry —
  // some come back with name: null. Fall back to the English translation,
  // then the raw code, so we never violate the not-null columns below.
  const cityNameByCode = new Map(cities.map((c) => [c.code, c.name ?? c.name_translations?.en ?? c.code]));
  const countryNameByCode = new Map(
    countries.map((c) => [c.code, c.name ?? c.name_translations?.en ?? c.code]),
  );

  const rows = airports
    .filter((airport) => airport.flightable && airport.code)
    .map((airport) => {
      const name = airport.name ?? airport.name_translations?.en ?? airport.code;
      return {
        iata_code: airport.code,
        name,
        city: cityNameByCode.get(airport.city_code) ?? name,
        country: countryNameByCode.get(airport.country_code) ?? airport.country_code ?? '',
        source: 'travelpayouts',
      };
    });

  console.log(`Upserting ${rows.length} flightable airports into Supabase...`);

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/airports?on_conflict=iata_code`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify(batch),
    });

    if (!res.ok) {
      throw new Error(
        `Upsert batch ${i}-${i + batch.length} failed: ${res.status} ${await res.text()}`,
      );
    }
    console.log(`  ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length}`);
  }

  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
