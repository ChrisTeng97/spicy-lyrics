import { matchSong, parseLrc, type SupplementalLyrics, type TrackIdentity } from "./model.ts";

/** Public metadata/lyrics via Spicetify's CORS-capable request helper (which may use its proxy).
 * No Spotify token, NetEase cookie or user identifier is attached by this adapter.
 */
async function request(path: string, params: Record<string, string>): Promise<any> {
  const url = `https://music.163.com/api/${path}?${new URLSearchParams(params)}`;
  let timer: ReturnType<typeof setTimeout>;
  try {
    const data = await Promise.race([
      Spicetify.CosmosAsync.get(url),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("NetEase request timed out")), 8000);
      }),
    ]);
    if (data?.code !== 200)
      throw new Error(`NetEase returned ${data?.code ?? "an invalid response"}`);
    return data;
  } finally {
    clearTimeout(timer!);
  }
}

export async function lookupNetease(
  track: TrackIdentity,
  isCurrent: () => boolean
): Promise<SupplementalLyrics | null> {
  if (!isCurrent()) throw new Error("Track changed before NetEase search");
  const search = await request("search/get", {
    s: `${track.title} ${track.artists.join(" ")}`,
    type: "1",
    limit: "10",
  });
  if (typeof search.result !== "object" || !search.result)
    throw new Error("Invalid NetEase search response");
  const song = matchSong(track, Array.isArray(search.result.songs) ? search.result.songs : []);
  if (!song) return null;
  if (!isCurrent()) throw new Error("Track changed before NetEase lyrics request");
  const response = await request("song/lyric", {
    id: String(song.id),
    lv: "-1",
    tv: "-1",
    rv: "-1",
    kv: "-1",
  });
  const Content = parseLrc(response.lrc?.lyric, track.durationMs);
  if (!Content.length) return null;
  const now = Date.now();
  return {
    Type: "Line",
    source: "ncm",
    uri: track.uri,
    Content,
    StartTime: Content[0].StartTime,
    EndTime: Content.at(-1)!.EndTime,
    NeteaseFallback: {
      songId: song.id,
      url: `https://music.163.com/song?id=${song.id}`,
      fetchedAt: now,
      primaryCheckedAt: now,
    },
  };
}
