import { PickDisplayText } from "../../utils/Lyrics/Applyer/Utils/PickDisplayText.ts";
import { StripZeroWidth } from "../../utils/Lyrics/Applyer/Utils/StripZeroWidth.ts";

export interface ShareLine {
  id: number;
  text: string;
  startTime?: number;
}
export interface ShareTrack {
  uri: string;
  title: string;
  artist: string;
  coverUri: string;
  lines: ShareLine[];
  fontFamily: string;
}
export type ShareRatio = "1:1" | "3:4" | "9:16";
export interface ShareOptions {
  selected: number[];
  ratio: ShareRatio;
  cover: boolean;
  title: boolean;
  artist: boolean;
}
interface Part {
  Text?: string;
  TransliteratedText?: string;
  IsPartOfWord?: boolean;
}
interface Group {
  Syllables?: Part[];
  StartTime?: number;
}
interface Entry extends Part {
  Lead?: Group;
  Background?: Group[];
  StartTime?: number;
}
/** Reconstruct complete words, independently of animation spans or virtualization. */
export function joinSyllables(parts: Part[], romanized = false): string {
  let result = "";
  parts.forEach((part, i) => {
    const text = PickDisplayText(part, romanized);
    if (!text) return;
    const previous = parts[i - 1];
    const noSpace = !result || previous?.IsPartOfWord || /\s$/.test(result) || /^\s/.test(text);
    result += (noSpace ? "" : " ") + text;
  });
  return StripZeroWidth(result);
}

export function shareLines(type: string, content: unknown, romanized = false): ShareLine[] {
  if (!Array.isArray(content) || !["Line", "Syllable", "Static"].includes(type)) return [];
  const lines: ShareLine[] = [];
  let index = 0;
  const append = (text: string, startTime?: number) => {
    for (const row of StripZeroWidth(text).split(/\r?\n/)) {
      const id = index++;
      if (row.trim()) lines.push({ id, text: row, startTime });
    }
  };
  for (const entry of content as Entry[]) {
    if (!entry || typeof entry !== "object") continue;
    if (type === "Syllable") {
      const groups = [entry.Lead, ...(entry.Background ?? [])];
      for (const group of groups) {
        if (Array.isArray(group?.Syllables))
          append(joinSyllables(group.Syllables, romanized), group.StartTime);
      }
    } else append(PickDisplayText(entry, romanized), entry.StartTime);
  }
  return lines;
}

/** Filtering the source, rather than the selection, preserves order and repeated lines. */
export function selectedLines(lines: ShareLine[], ids: number[]): ShareLine[] {
  const selected = new Set(ids);
  return lines.filter((line) => selected.has(line.id));
}

export function selectedText(lines: ShareLine[], ids: number[]): string {
  return selectedLines(lines, ids)
    .map((line) => line.text)
    .join("\n");
}

export const IMAGE_WIDTH = 1080;
export const LYRIC_SIZE = 68;
export const LINE_HEIGHT = LYRIC_SIZE * 1.55;
export const MAX_IMAGE_HEIGHT = 16384;
export const ratioHeights: Record<ShareRatio, number> = { "1:1": 1080, "3:4": 1440, "9:16": 1920 };

/** Prefer word boundaries; split oversized words only at grapheme boundaries. */
export function wrapText(
  text: string,
  width: number,
  measure: (value: string) => number
): string[] {
  const words = new Intl.Segmenter(undefined, { granularity: "word" });
  const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  const rows: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    let row = "";
    for (const { segment } of words.segment(paragraph)) {
      if (row && measure(row + segment) > width) {
        rows.push(row.trimEnd());
        row = "";
      }
      if (!row && !segment.trim()) continue;
      if (measure(segment) > width) {
        for (const { segment: char } of graphemes.segment(segment)) {
          if (row && measure(row + char) > width) {
            rows.push(row);
            row = "";
          }
          row += char;
        }
      } else row += segment;
    }
    if (row.trim()) rows.push(row.trimEnd());
  }
  return rows;
}

export function shareFilename(title: string): string {
  return (
    (title
      .replace(/[<>:"/\\|?*]/g, "_")
      .replace(/\p{Cc}/gu, "_")
      .slice(0, 100)
      .replace(/[. ]+$/, "") || "Lyrics") + " - lyrics.png"
  );
}
