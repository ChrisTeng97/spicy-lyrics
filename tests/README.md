# Settings language and lyric preferences

Run `bun test tests/settings-search.test.ts` for locale resolution, English fallback,
interpolation, bilingual search, mixed queries, full-width input and label ranking.

Open `tests/lyrics-preferences.html` in a current Chromium browser. It loads the
real lyric stylesheet and reports PASS or FAIL. It covers the standard, simple,
and refreshed simple renderers in both text directions, interlude isolation,
independent toggles, and restoration of computed styles when the flags are off.
It also checks Disable Lyrics Glow on active text and restoration when disabled,
without changing inactive-line distance blur.

For integration testing, build with `bun run build --no-copy` and load the generated
extension into a compatible Spotify/Spicetify installation. Avoid simultaneously
loading another copy of Spicy Lyrics.

1. Open the dedicated Language sidebar tab and choose English, Simplified Chinese,
   then Follow Spotify.
   Verify translated labels, descriptions, option labels, accessibility labels and
   empty search results; underlying option values should not change.
2. Search for `逐行`, `整行`, `不模糊`, `同步`, `word by word`, and `逐行 bounce`
   in both languages. A query such as `无此设置123` should return no results.
   Also try `line by line`, `line-by-line`, `no blur`, `bloom`, `halo` and `language`.
   The language selector should appear once in search and stay focused after switching.
3. Under Experiments enable Line-only Lyrics and Clear Lyrics. Play word-synced
   lyrics and confirm each active line highlights together, upcoming lyrics remain
   sharp, and automatic scrolling and overlapping voices retain their timing.
4. Toggle each preference independently. Turning both off should restore the
   original word effects and distance blur. Repeat with Simple Lyrics Mode and
   Refreshed Simple Lyrics Mode. Reload and confirm language and preferences persist.
5. Search for `泛光`, `发光`, `光晕` or `glow`. Toggle Disable Lyrics Glow with
   the other two preferences both off and on. Active text should have no glow;
   turning the toggle off restores the original glow, without changing brightness,
   inactive-line blur or background effects.
   Hover an active, upcoming and finished line: the highlight box must remain,
   but its backdrop blur must be absent while Disable Lyrics Glow is enabled.
   With the option off, the original 2px hover backdrop blur must return. Check
   actual rendered text as well as text-shadow; backdrop blur can also create a halo.

These experiments default to off for existing installations. They affect lyric
presentation; they do not replace lyric timing data or stop the underlying animator.

## Lyric sharing

Run `bun test tests/lyrics-share.test.ts tests/settings-search.test.ts`. The text
tests cover syllable boundaries (including spaces between Chinese phrases),
literal whitespace, romanization, background vocals, repeated lines, selection
order, grapheme-safe wrapping and Windows filenames.

Lyric Sharing defaults to on. Open the full lyrics page and use Share lyrics:

1. Check nonadjacent lines and copy lyrics. Only those lines should be copied,
   in source order with their original spaces; Windows may use CRLF newlines.
2. Switch between 1:1, 3:4 and 9:16; toggle cover, title and artist separately.
   Select all to verify automatic long-image layout without reducing font size.
3. Freeze the background, copy the image and save a PNG. Inspect the actual
   clipboard image and downloaded file, not just the success message.
4. Change the playing track while the editor is open. Its song, cover and lyrics
   should stay unchanged. Selecting a lyric must not seek playback.
5. Check English and Simplified Chinese, keyboard focus, Escape, empty selection,
   unavailable cover, reduced motion and an excessively long selection.

The editor shares the live page's Kawarp background settings but owns its renderer
and cover snapshot. Exports freeze it, contain no watermark and use clear static
text independently of playback highlighting and glow preferences.

## NetEase fallback for missing lyrics

Run `bun test tests/netease-fallback.test.ts`. Covers strict title/artist/version/
duration matching, ambiguous candidates, LRC whitespace and timing, the exact
404 trigger, persistent positive and negative results, and retry intervals.

Enable **NetEase Missing Lyrics** (default on; searchable as `网易云`, `补词`,
`netease`, `fallback`). It only searches after `lyrics-not-found (404)`, including
saved-state and cached misses. No search is made on 429, 503, service/network
failure or malformed query envelopes. Manual TTML imports retain priority.

Automatic results are stored separately in IndexedDB `spicylyrics-supplemental`,
store `netease`, keyed by Spotify URI. They do not overwrite the manual TTML
library or primary lyrics cache. Positive records retain the original source
song ID and URL. Misses retry after 24 hours; failures after 15 minutes. **Search
again** on the no-lyrics notice bypasses the cooldown and checks the primary
service again. Saved absence is rechecked after seven days; newly available
primary lyrics win. Disabling the experiment ignores saved supplements.

Requests use `Spicetify.CosmosAsync` with NetEase metadata/lyrics URLs; Spicetify
may route them through its CORS proxy. This adapter adds no Spotify token or
NetEase cookie. Requests time out after eight seconds; uncertain song matches
are left unresolved. Only line-synced LRC is supported in this first version.

Integration checks on a compatible Spotify installation:

1. Play a confirmed missing track. Verify a search and lyric request, then a
   visible NetEase source credit and a saved record. Reload: no new NetEase
   request should be made, and timed lyrics should still display.
2. Exercise a saved `NO_LYRICS` state and a cached miss, not just an API 404.
   Confirm the supplement replaces the old no-lyrics state immediately.
3. Return 429/500/503 or a transport failure from the primary service: expect
   the corresponding notice and zero NetEase requests. Existing primary lyrics
   must also produce zero NetEase requests.
4. Change tracks during a delayed search; the old lyrics must not paint over
   the new song. Toggle the experiment off/on and check bilingual settings.
5. Verify repeated playback, line seeking, copying and sharing. Clear application
   storage only in a disposable profile: browser-local storage is not a backup.
