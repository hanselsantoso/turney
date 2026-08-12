import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { db, sql } from "./client";
import { parts } from "./schema";

type RawPart = {
  name: string;
  alias?: string;
  attack?: number;
  defense?: number;
  stamina?: number;
  type?: string;
  line?: string;
  [k: string]: unknown;
};

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, "..", "..", "data");

async function main() {
  const raw = JSON.parse(readFileSync(join(dataDir, "beyparts.json"), "utf8")) as Record<
    string,
    RawPart[]
  >;
  const points = JSON.parse(readFileSync(join(dataDir, "part_points.json"), "utf8")) as Record<
    string,
    number
  >;

  const kinds: Array<[keyof typeof raw & string, "blade" | "ratchet" | "bit" | "assist_blade"]> = [
    ["blades", "blade"],
    ["ratchets", "ratchet"],
    ["bits", "bit"],
    ["assistBlades", "assist_blade"],
  ];

  let total = 0;
  for (const [key, kind] of kinds) {
    for (const p of raw[key] ?? []) {
      const { name, alias, attack, defense, stamina, type, line, ...extra } = p;
      await db
        .insert(parts)
        .values({
          kind,
          name,
          alias: alias ?? null,
          attack: attack ?? 0,
          defense: defense ?? 0,
          stamina: stamina ?? 0,
          type: type ?? null,
          line: line ?? null,
          points: points[name] ?? null,
          extra: Object.keys(extra).length ? extra : null,
        })
        .onConflictDoNothing();
      total++;
    }
  }
  console.log(`Seeded ${total} parts`);
  await sql.end();
}

main();
