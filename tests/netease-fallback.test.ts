/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import { separateCredits } from "../src/utils/Lyrics/fallback/credits.ts";
import {
  ERROR_RETRY_MS,
  MISS_RETRY_MS,
  PRIMARY_RECHECK_MS,
  isMissingLyrics,
  matchSong,
  parseLrc,
  type SupplementalLyrics,
  type TrackIdentity,
} from "../src/utils/Lyrics/fallback/model.ts";
import {
  primaryCheckDue,
  resolveFallback,
  type FallbackRecord,
  type FallbackStore,
} from "../src/utils/Lyrics/fallback/cache.ts";

const track: TrackIdentity = {
  uri: "spotify:track:test",
  title: "Song",
  artists: ["Artist"],
  album: "Album",
  durationMs: 120000,
};
const song = {
  id: 1,
  name: "Song",
  artists: [{ name: "Artist" }],
  album: { name: "Album" },
  duration: 120001,
};
function lyrics(): SupplementalLyrics {
  return {
    Type: "Line",
    source: "ncm",
    uri: track.uri,
    StartTime: 1,
    EndTime: 120,
    Content: parseLrc("[00:01.00]first\n[00:03.00]second", track.durationMs),
    NeteaseFallback: {
      songId: 1,
      url: "https://music.163.com/song?id=1",
      fetchedAt: 100,
      primaryCheckedAt: 100,
    },
  };
}
function memoryStore() {
  const records = new Map<string, FallbackRecord>();
  const store: FallbackStore = {
    async get(uri) {
      return records.get(uri);
    },
    async put(uri, value) {
      records.set(uri, structuredClone(value));
    },
  };
  return { records, store };
}

describe("NetEase matching and line timing", () => {
  test("moves leading and trailing production credits out of timed lyrics without changing lyric timing", () => {
    const original = {
      ...lyrics(),
      Content: parseLrc(
        "[00:00] 作词 : 张醒婵\n[00:01]作曲：张醒婵\n[00:02]编曲: 张醒婵\n[01:05.177]第一句  保留空格\n[01:16.219]第二句\n[01:50]混音: Someone",
        120000
      ),
    };
    const result = separateCredits(original);
    expect(result.Content.map((row) => [row.Text, row.StartTime, row.EndTime])).toEqual([
      ["第一句  保留空格", 65.177, 76.219],
      ["第二句", 76.219, 110],
    ]);
    expect(result.StartTime).toBe(65.177);
    expect(result.ProductionCredits).toEqual([
      { role: "Lyricist", name: "张醒婵" },
      { role: "Composer", name: "张醒婵" },
      { role: "Arranger", name: "张醒婵" },
      { role: "Mixing", name: "Someone" },
    ]);
    expect(original.Content.length).toBe(6);
    expect(separateCredits(result)).toBe(result);
  });
  test("recognizes explicit combined credit roles but preserves unknown labels and lyric fragments", () => {
    const result = separateCredits({
      ...lyrics(),
      Content: parseLrc(
        "[00:00]作詞/作曲：A / B\n[00:01]作詞/作曲：A / B\n[00:10]我为你作词作曲\n[00:20]作词：这是正文中的一句\n[00:30]最后一句",
        120000
      ),
    });
    expect(result.ProductionCredits).toEqual([
      { role: "Lyricist", name: "A / B" },
      { role: "Composer", name: "A / B" },
    ]);
    expect(result.Content.map((row) => row.Text)).toEqual([
      "我为你作词作曲",
      "作词：这是正文中的一句",
      "最后一句",
    ]);
    const unknown = { ...lyrics(), Content: parseLrc("[00:01]他说：你好\n[00:02]歌词", 120000) };
    expect(separateCredits(unknown)).toBe(unknown);
    expect(
      separateCredits({ ...lyrics(), Content: parseLrc("[00:00]作词：A", 120000) }).Content
    ).toEqual([]);
  });
  test("only confirmed lyric absence can start supplementation", () => {
    expect(isMissingLyrics(["lyrics-not-found", 404])).toBe(true);
    for (const result of [
      null,
      ["rate-limited", 429],
      ["lyrics-queued", 503],
      ["service-unavailable", 0],
      ["status-not-200", 404],
      ["lyrics-not-found", 200],
      [{ Type: "Line" }, 200],
    ] as any[])
      expect(isMissingLyrics(result)).toBe(false);
  });
  test("requires matching title, all artists and duration, preserving version names", () => {
    expect(matchSong(track, [song])?.id).toBe(1);
    for (const changed of [
      { name: "Song (Live)" },
      { duration: 160000 },
      { artists: [{ name: "Cover artist" }] },
      { artists: [{ name: "Artist" }, { name: "Guest" }] },
    ])
      expect(matchSong(track, [{ ...song, ...changed }])).toBeNull();
    expect(matchSong({ ...track, durationMs: 0 }, [song])).toBeNull();
    expect(matchSong(track, [song, { ...song, id: 2 }])).toBeNull();
    expect(matchSong(track, [song, { ...song, id: 2, album: { name: "Other" } }])?.id).toBe(1);
  });
  test("preserves spaces and repeats, handles offsets, timestamp precision and silent gaps", () => {
    const rows = parseLrc(
      "[ar:test]\n[offset:500]\n[00:01.2][00:06.234]日常  沉默不回答\n[00:03.45]\n[00:08.000]second",
      10000
    );
    expect(rows.map((r) => [r.Text, r.StartTime, r.EndTime])).toEqual([
      ["日常  沉默不回答", 1.7, 3.95],
      ["日常  沉默不回答", 6.734, 8.5],
      ["second", 8.5, 10],
    ]);
    expect(parseLrc("[00:01]纯音乐，请欣赏", 10000)).toEqual([]);
    expect(parseLrc("plain text only", 10000)).toEqual([]);
    expect(parseLrc("[99:01]invalid for this recording", 10000)).toEqual([]);
    expect(parseLrc("[00:02]B\n[00:01]A", 10000).map((r) => r.Text)).toEqual(["A", "B"]);
  });
});

describe("supplemental storage and retry policy", () => {
  test("persists positive matches and reuses them without a provider request", async () => {
    const { store } = memoryStore();
    let calls = 0;
    const lookup = async () => {
      calls++;
      return lyrics();
    };
    await resolveFallback(track, store, lookup, { now: 100 });
    const cached = await resolveFallback(track, store, lookup, {
      now: 200,
      primaryWasChecked: true,
    });
    expect(calls).toBe(1);
    expect(cached?.NeteaseFallback.primaryCheckedAt).toBe(200);
    expect((await store.get(track.uri))?.lyrics?.Content.length).toBe(2);
    expect(primaryCheckDue(await store.get(track.uri), 200 + PRIMARY_RECHECK_MS)).toBe(true);
  });
  test("negative results survive reloads and permit a user-requested retry", async () => {
    const { store } = memoryStore();
    let calls = 0;
    const lookup = async () => {
      calls++;
      return null;
    };
    await resolveFallback(track, store, lookup, { now: 100 });
    await resolveFallback(track, store, lookup, { now: 200 });
    expect(calls).toBe(1);
    expect((await store.get(track.uri))?.nextSearchAt).toBe(100 + MISS_RETRY_MS);
    await resolveFallback(track, store, lookup, { now: 300, force: true });
    expect(calls).toBe(2);
    await resolveFallback(track, store, lookup, { now: 300 + MISS_RETRY_MS });
    expect(calls).toBe(3);
  });
  test("network errors use a shorter retry interval and never become successful empty lyrics", async () => {
    const { store } = memoryStore();
    await expect(
      resolveFallback(
        track,
        store,
        async () => {
          throw Error("network");
        },
        { now: 100 }
      )
    ).rejects.toThrow("network");
    expect(await store.get(track.uri)).toEqual({
      version: 1,
      primaryCheckedAt: 100,
      nextSearchAt: 100 + ERROR_RETRY_MS,
      outcome: "error",
    });
    const result = await resolveFallback(
      track,
      store,
      async () => {
        throw Error("must not be called");
      },
      { now: 200 }
    );
    expect(result).toBeNull();
  });
});
