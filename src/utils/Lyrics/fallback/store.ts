import { openDB } from "idb";
import type { FallbackRecord, FallbackStore } from "./cache.ts";

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
    return record?.version === 1 ? record : undefined;
  },
  async put(uri, record) {
    await (await getDatabase()).put("netease", record, uri);
  },
};
