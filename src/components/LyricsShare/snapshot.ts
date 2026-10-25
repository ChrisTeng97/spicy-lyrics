import Global from "../Global/Global.ts";
import { SpotifyPlayer } from "../Global/SpotifyPlayer.ts";
import { isRomanized } from "../../utils/Lyrics/lyrics.ts";
import { shareLines, type ShareTrack } from "./model.ts";

let current: ShareTrack | null = null;
function refreshButton() {
  const button = document.getElementById("ShareLyrics") as HTMLButtonElement | null;
  if (button) button.disabled = !getShareTrack();
}
export function getShareTrack(): ShareTrack | null {
  return current?.uri === SpotifyPlayer.GetUri() ? current : null;
}
Global.Event.listen("lyrics:apply", ({ Type, Content }: { Type: string; Content: unknown }) => {
  const lines = shareLines(Type, Content, isRomanized);
  const uri = SpotifyPlayer.GetUri();
  const textElement = document.querySelector("#SpicyLyricsPage .LyricsContent");
  current =
    lines.length && uri
      ? {
          uri,
          title: SpotifyPlayer.GetName() ?? "",
          artist: (SpotifyPlayer.GetArtists() ?? []).map((artist) => artist.name).join(", "),
          coverUri: SpotifyPlayer.GetCover("large") ?? "",
          lines,
          fontFamily: textElement ? getComputedStyle(textElement).fontFamily : "sans-serif",
        }
      : null;
  refreshButton();
});
for (const event of ["lyrics:not-apply", "playback:songchange", "page:close"]) {
  Global.Event.listen(event, () => {
    current = null;
    refreshButton();
  });
}
