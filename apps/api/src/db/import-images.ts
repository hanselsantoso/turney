/* Pulls part images from beybladebrew.com's public widget bundle.
   Their data ships inline: part entries carry image filenames, plus a
   lowercased filename -> i.postimg.cc URL map. We match our parts by
   normalized name and store the hosted URL in parts.image_url.
   Community data source per product brief; credited in app. Re-run when
   their bundle hash changes (update CHUNK below). */
import { eq } from "drizzle-orm";
import { db, sql } from "./client";
import { parts } from "./schema";

const CHUNK = "https://beybladebrew.com/assets/ConfigurableComboWidget-Bu52c07f.js";

const norm = (s: string) => s.toLowerCase().replace(/\.(webp|jpe?g|png|avif)$/i, "").replace(/[^a-z0-9]/g, "");

async function main() {
  const js = await (await fetch(CHUNK)).text();

  /* 1. filename-key -> hosted URL map */
  const urlByKey = new Map<string, string>();
  for (const m of js.matchAll(/"([a-z0-9 _\-]+)":"(https:\/\/i\.postimg\.cc\/[^"]+)"/g)) {
    urlByKey.set(norm(m[1]), m[2]);
  }

  /* 2. part name -> image filename (first image per entry) */
  const fileByName = new Map<string, string>();
  for (const m of js.matchAll(/name:`([^`]+)`[^{}]*?image:`([^`]+)`/g)) {
    if (!fileByName.has(m[1])) fileByName.set(m[1], m[2]);
  }

  const rows = await db.select().from(parts);
  let matched = 0;
  const misses: string[] = [];

  for (const p of rows) {
    const pn = norm(p.name);
    /* try their entry names first (handles "Dran Sword" vs "DranSword") */
    let file: string | undefined;
    for (const [name, f] of fileByName) {
      if (norm(name) === pn) {
        file = f;
        break;
      }
    }
    /* candidate keys: from entry filename, else guessed kind-prefixed names */
    const candidates = [
      file ? norm(file) : null,
      `blade${pn}`,
      `ratchetblade${pn}`,
      pn,
      `assistblade${pn}`,
      `bit${pn}`,
    ].filter(Boolean) as string[];

    let url: string | undefined;
    for (const c of candidates) {
      url = urlByKey.get(c);
      if (url) break;
    }
    /* last resort: unique substring match */
    if (!url) {
      const hits = [...urlByKey.entries()].filter(([k]) => k.includes(pn));
      if (hits.length === 1) url = hits[0][1];
    }

    if (url) {
      await db.update(parts).set({ imageUrl: url }).where(eq(parts.id, p.id));
      matched++;
    } else {
      misses.push(`${p.kind}:${p.name}`);
    }
  }

  console.log(`Images matched: ${matched}/${rows.length}`);
  if (misses.length) console.log("No image:", misses.slice(0, 20).join(", "), misses.length > 20 ? `(+${misses.length - 20})` : "");
  await sql.end();
}

main();
