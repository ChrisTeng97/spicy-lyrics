export interface TrackIdentity {
  uri: string;
  title: string;
  artists: string[];
  album: string;
  durationMs: number;
}

export interface NeteaseSong {
  id: number;
  name: string;
  artists: { name: string }[];
  album: { name: string };
  duration: number;
}

export interface SupplementalLyrics {
  Type: "Line";
  source: "ncm";
  uri: string;
  StartTime: number;
  EndTime: number;
  Content: {
    Type: "Vocal";
    Text: string;
    StartTime: number;
    EndTime: number;
    OppositeAligned: false;
  }[];
  NeteaseFallback: { songId: number; url: string; fetchedAt: number; primaryCheckedAt: number };
}

export const PRIMARY_RECHECK_MS = 7 * 24 * 60 * 60 * 1000;
export const MISS_RETRY_MS = 24 * 60 * 60 * 1000;
export const ERROR_RETRY_MS = 15 * 60 * 1000;

export function isMissingLyrics(result: [unknown, number] | null | undefined): boolean {
  return result?.[0] === "lyrics-not-found" && result[1] === 404;
}

function normalized(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\p{P}\p{Z}\s]/gu, "");
}

/** Keep version words (live, remix, instrumental…) and require all credited artists. */
export function matchSong(track: TrackIdentity, songs: NeteaseSong[]): NeteaseSong | null {
  if (!track.title || !track.artists.length || !(track.durationMs > 0)) return null;
  const artists = track.artists.map(normalized).sort().join("\0");
  const matches = songs.filter(
    (song) =>
      Number.isSafeInteger(song?.id) &&
      song.id > 0 &&
      typeof song.name === "string" &&
      normalized(song.name) === normalized(track.title) &&
      Array.isArray(song.artists) &&
      song.artists.every((a) => typeof a?.name === "string") &&
      song.artists
        .map((a) => normalized(a.name))
        .sort()
        .join("\0") === artists &&
      Number.isFinite(song.duration) &&
      Math.abs(song.duration - track.durationMs) <= 3000
  );
  const albumMatches = matches.filter(
    (s) =>
      track.album &&
      typeof s.album?.name === "string" &&
      normalized(s.album.name) === normalized(track.album)
  );
  const candidates = albumMatches.length ? albumMatches : matches;
  const unique = [...new Map(candidates.map((s) => [s.id, s])).values()];
  return unique.length === 1 ? unique[0] : null;
}

/** LRC has line starts, not word timings. Empty timed lines terminate a preceding line. */
export function parseLrc(lrc: string, durationMs: number): SupplementalLyrics["Content"] {
  if (
    typeof lrc !== "string" ||
    lrc.length > 1_000_000 ||
    !Number.isFinite(durationMs) ||
    !(durationMs > 0)
  )
    return [];
  if (/纯音乐[，,\s]*请欣赏/.test(lrc)) return [];
  const offset = Number(lrc.match(/\[offset:([+-]?\d+)\]/i)?.[1] ?? 0) / 1000;
  const duration = durationMs / 1000;
  const rows: { time: number; text: string }[] = [];
  for (const line of lrc
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .slice(0, 5000)) {
    const tags = [...line.matchAll(/\[(\d{1,3}):([0-5]\d)(?:[.:](\d{1,3}))?\]/g)];
    if (!tags.length) continue;
    const last = tags.at(-1)!;
    const text = line.slice(last.index! + last[0].length).trim();
    for (const tag of tags) {
      const time = Math.max(
        0,
        Number(tag[1]) * 60 + Number(tag[2]) + Number(`0.${tag[3] ?? 0}`) + offset
      );
      if (time < duration) rows.push({ time, text });
      if (rows.length > 5000) return [];
    }
  }
  rows.sort((a, b) => a.time - b.time);
  const content: SupplementalLyrics["Content"] = [];
  let end = duration;
  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i];
    if (rows[i + 1]?.time > row.time) end = rows[i + 1].time;
    if (row.text)
      content.push({
        Type: "Vocal" as const,
        Text: row.text,
        StartTime: row.time,
        EndTime: end,
        OppositeAligned: false as const,
      });
  }
  return content.reverse();
}
