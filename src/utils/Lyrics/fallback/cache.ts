import {
  ERROR_RETRY_MS,
  MISS_RETRY_MS,
  PRIMARY_RECHECK_MS,
  type SupplementalLyrics,
  type TrackIdentity,
} from "./model.ts";

export interface FallbackRecord {
  version: 1;
  primaryCheckedAt: number;
  nextSearchAt: number;
  outcome: "found" | "missing" | "error";
  lyrics?: SupplementalLyrics;
}
export interface FallbackStore {
  get(uri: string): Promise<FallbackRecord | undefined>;
  put(uri: string, record: FallbackRecord): Promise<void>;
}

export function primaryCheckDue(record: FallbackRecord | undefined, now = Date.now()): boolean {
  return !!record && now - record.primaryCheckedAt >= PRIMARY_RECHECK_MS;
}

/** Successful supplements do not expire; only the upstream absence is periodically rechecked. */
export async function resolveFallback(
  track: TrackIdentity,
  store: FallbackStore,
  lookup: (track: TrackIdentity) => Promise<SupplementalLyrics | null>,
  options: { now?: number; primaryWasChecked?: boolean; force?: boolean } = {}
): Promise<SupplementalLyrics | null> {
  const now = options.now ?? Date.now();
  const previous = await store.get(track.uri);
  const primaryCheckedAt = options.primaryWasChecked ? now : (previous?.primaryCheckedAt ?? now);
  if (previous?.lyrics) {
    const lyrics = {
      ...previous.lyrics,
      NeteaseFallback: { ...previous.lyrics.NeteaseFallback, primaryCheckedAt },
    };
    await store.put(track.uri, { ...previous, primaryCheckedAt, lyrics });
    return lyrics;
  }
  if (!options.force && previous && now < previous.nextSearchAt) {
    if (options.primaryWasChecked) await store.put(track.uri, { ...previous, primaryCheckedAt });
    return null;
  }
  // Persist the retry guard before the request, so reloads cannot flood the provider.
  await store.put(track.uri, {
    version: 1,
    primaryCheckedAt,
    nextSearchAt: now + ERROR_RETRY_MS,
    outcome: "error",
  });
  const lyrics = await lookup(track);
  if (lyrics) lyrics.NeteaseFallback.primaryCheckedAt = primaryCheckedAt;
  await store.put(track.uri, {
    version: 1,
    primaryCheckedAt,
    nextSearchAt: now + MISS_RETRY_MS,
    outcome: lyrics ? "found" : "missing",
    ...(lyrics ? { lyrics } : {}),
  });
  return lyrics;
}
