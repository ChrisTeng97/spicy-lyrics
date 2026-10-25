import type { SupplementalLyrics } from "./model.ts";

const roles: Record<string, string> = {
  作词: "Lyricist",
  作詞: "Lyricist",
  词: "Lyricist",
  詞: "Lyricist",
  lyricist: "Lyricist",
  lyrics: "Lyricist",
  作曲: "Composer",
  曲: "Composer",
  composer: "Composer",
  composition: "Composer",
  词曲: "Songwriter",
  詞曲: "Songwriter",
  songwriter: "Songwriter",
  编曲: "Arranger",
  編曲: "Arranger",
  arranger: "Arranger",
  arrangement: "Arranger",
  制作人: "Producer",
  製作人: "Producer",
  producer: "Producer",
  监制: "Executive producer",
  監製: "Executive producer",
  录音: "Recording",
  錄音: "Recording",
  录音师: "Recording",
  錄音師: "Recording",
  recording: "Recording",
  混音: "Mixing",
  混音师: "Mixing",
  混音師: "Mixing",
  mixing: "Mixing",
  母带: "Mastering",
  母帶: "Mastering",
  mastering: "Mastering",
  和声: "Backing vocals",
  和聲: "Backing vocals",
  吉他: "Guitar",
  guitar: "Guitar",
  贝斯: "Bass",
  貝斯: "Bass",
  bass: "Bass",
  鼓: "Drums",
  drums: "Drums",
};

function readCredit(text: string): NonNullable<SupplementalLyrics["ProductionCredits"]> | null {
  const match = text.match(/^\s*([^:：]{1,60})\s*[:：]\s*(\S.*?)\s*$/u);
  if (!match) return null;
  const labels = match[1]
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s/g, "")
    .split(/[/、&+]/);
  if (!labels.length || labels.some((label) => !Object.hasOwn(roles, label))) return null;
  return labels.map((label) => ({ role: roles[label], name: match[2] }));
}

/** Only remove explicit credit blocks at the edges, never matching lyric fragments in the middle. */
export function separateCredits(lyrics: SupplementalLyrics): SupplementalLyrics {
  const credits = [...(lyrics.ProductionCredits ?? [])];
  let first = 0;
  let last = lyrics.Content.length;
  while (first < last) {
    const credit = readCredit(lyrics.Content[first].Text);
    if (!credit) break;
    credits.push(...credit);
    first++;
  }
  const trailing: typeof credits = [];
  while (last > first) {
    const credit = readCredit(lyrics.Content[last - 1].Text);
    if (!credit) break;
    trailing.unshift(...credit);
    last--;
  }
  if (first === 0 && last === lyrics.Content.length) return lyrics;
  credits.push(...trailing);
  const Content = lyrics.Content.slice(first, last);
  return {
    ...lyrics,
    Content,
    StartTime: Content[0]?.StartTime ?? 0,
    EndTime: Content.at(-1)?.EndTime ?? 0,
    ProductionCredits: [
      ...new Map(credits.map((credit) => [`${credit.role}\0${credit.name}`, credit])).values(),
    ],
  };
}
