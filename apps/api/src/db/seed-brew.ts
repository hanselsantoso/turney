/* Full catalog import from beybladebrew.com's public widget bundle.
   Upserts blades / ratchets / bits / assist blades / lock chips with stats,
   line, description, and hosted image URL. Supersedes the old beyparts.json
   seed (kept for offline fallback). Credited in app. Update CHUNK on their
   next deploy (hash changes). */
import { and, eq } from "drizzle-orm";
import { db, sql } from "./client";
import { parts } from "./schema";

const CHUNK = "https://beybladebrew.com/assets/ConfigurableComboWidget-Bu52c07f.js";

type Kind = "blade" | "ratchet" | "bit" | "assist_blade" | "lock_chip";

const norm = (s: string) =>
  s.toLowerCase().replace(/\.(webp|jpe?g|png|avif)$/i, "").replace(/[^a-z0-9]/g, "");

function classify(image: string, name: string): Kind {
  const f = image.toLowerCase();
  if (f.startsWith("lockchip")) return "lock_chip";
  if (f.startsWith("assist")) return "assist_blade";
  if (f.startsWith("bit") && !f.startsWith("bite")) return "bit";
  if (f.startsWith("ratchet") && !f.startsWith("ratchetblade")) return "ratchet";
  if (/^blade|^ratchetblade/.test(f)) return "blade";
  /* filename doesn't declare kind (e.g. StormPegasis_3-70RA.jpeg): ratchets
     look like "3-60", bits are short alnum, otherwise assume blade */
  if (/^\d-\d\d/.test(name) || /^[MU]?\d{1,2}-\d{2}/.test(name)) return "ratchet";
  return "blade";
}

async function main() {
  const js = await (await fetch(CHUNK)).text();

  /* hosted image map: lowercased filename key -> URL */
  const urlByKey = new Map<string, string>();
  for (const m of js.matchAll(/"([a-z0-9 _\-]+)":"(https:\/\/i\.postimg\.cc\/[^"]+)"/g)) {
    urlByKey.set(norm(m[1]), m[2]);
  }

  /* part entries: name/stats/type/line/image (+modes for variable parts) */
  type Entry = {
    name: string;
    attack: number;
    defense: number;
    stamina: number;
    type: string | null;
    line: string | null;
    image: string;
  };
  const entries = new Map<string, Entry>();
  const objRe =
    /\{name:`([^`]+)`((?:[^{}]|\{[^{}]*\})*?)image:`([^`]+)`((?:[^{}]|\{[^{}]*\})*?)\}/g;
  for (const m of js.matchAll(objRe)) {
    const [, name, pre, image, post] = m;
    const body = pre + post;
    const num = (k: string) => {
      const mm = body.match(new RegExp(`${k}:(-?\\d+(?:\\.\\d+)?)`));
      return mm ? Number(mm[1]) : 0;
    };
    const str = (k: string) => {
      const mm = body.match(new RegExp(`${k}:\`([^\`]+)\``));
      return mm ? mm[1] : null;
    };
    if (!entries.has(name)) {
      entries.set(name, {
        name,
        attack: num("attack"),
        defense: num("defense"),
        stamina: num("stamina"),
        type: str("type"),
        line: str("line"),
        image,
      });
    }
  }

  let inserted = 0,
    updated = 0;
  for (const e of entries.values()) {
    const kind = classify(e.image, e.name);
    const imageUrl = urlByKey.get(norm(e.image)) ?? null;
    const existing = await db
      .select()
      .from(parts)
      .where(and(eq(parts.kind, kind), eq(parts.name, e.name)));
    if (existing.length > 0) {
      await db
        .update(parts)
        .set({
          attack: e.attack || existing[0].attack,
          defense: e.defense || existing[0].defense,
          stamina: e.stamina || existing[0].stamina,
          type: e.type ?? existing[0].type,
          line: e.line ?? existing[0].line,
          imageUrl: imageUrl ?? existing[0].imageUrl,
        })
        .where(eq(parts.id, existing[0].id));
      updated++;
    } else {
      await db.insert(parts).values({
        kind,
        name: e.name,
        attack: e.attack,
        defense: e.defense,
        stamina: e.stamina,
        type: e.type,
        line: e.line,
        imageUrl,
      });
      inserted++;
    }
  }
  const counts = await db.select().from(parts);
  const byKind: Record<string, number> = {};
  for (const p of counts) byKind[p.kind] = (byKind[p.kind] ?? 0) + 1;
  console.log(`brew import: +${inserted} new, ~${updated} updated`);
  console.log("catalog:", JSON.stringify(byKind));
  await sql.end();
}

main();
