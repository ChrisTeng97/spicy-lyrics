import { openDB } from "idb";
import type { FallbackRecord, FallbackStore } from "./cache.ts";
import { separateCredits } from "./credits.ts";

// Keep automatic supplements separate from the user's manually imported TTML library.
let database: ReturnType<typeof openDB> | undefined;
function getDatabase() {
  return (database ??= openDB("spicylyrics-supplemental", 1, {
    upgrade(db) {
      db.createObjectStore("netease");
    },
  }));
}

export const fallbackStore: FallbackStore = {
  async get(uri) {
    const record = (await (await getDatabase()).get("netease", uri)) as FallbackRecord | undefined;
    if (record?.version !== 1) return undefined;
    if (record.lyrics) {
      const lyrics = separateCredits(record.lyrics);
      if (lyrics !== record.lyrics) {
        // Upgrade existing supplements in place, without redownloading or changing their match.
        record.lyrics = lyrics.Content.length ? lyrics : undefined;
        record.outcome = record.lyrics ? "found" : "missing";
        await (await getDatabase()).put("netease", record, uri);
      }
    }
    return record;
  },
  async put(uri, record) {
    await (await getDatabase()).put("netease", record, uri);
  },
};
