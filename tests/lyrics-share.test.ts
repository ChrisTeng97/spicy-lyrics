/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import {
  joinSyllables,
  shareLines,
  selectedLines,
  selectedText,
  wrapText,
  shareFilename,
} from "../src/components/LyricsShare/model.ts";

describe("lyric sharing text", () => {
  test("reconstructs whole words without losing word boundaries or Chinese text", () => {
    expect(
      joinSyllables([
        { Text: "Hel", IsPartOfWord: true },
        { Text: "lo" },
        { Text: "world", IsPartOfWord: true },
        { Text: "!" },
      ])
    ).toBe("Hello world!");
    expect(
      joinSyllables([
        { Text: "路", IsPartOfWord: true },
        { Text: "灯", IsPartOfWord: true },
        { Text: "，", IsPartOfWord: true },
        { Text: "晚归" },
      ])
    ).toBe("路灯，晚归");
    expect(joinSyllables([{ Text: "already " }, { Text: "spaced" }])).toBe("already spaced");
    expect(
      joinSyllables(
        [
          { Text: "你", TransliteratedText: "ni" },
          { Text: "好", TransliteratedText: "hao" },
        ],
        true
      )
    ).toBe("ni hao");
  });
  test("preserves original Chinese phrase boundaries and literal whitespace", () => {
    const line = joinSyllables([
      { Text: "也只能當作", IsPartOfWord: true },
      { Text: "消遣吧", IsPartOfWord: false },
      { Text: "他這樣想" },
    ]);
    expect(line).toBe("也只能當作消遣吧 他這樣想");
    expect(joinSyllables([{ Text: "日常  " }, { Text: "沉默不回答" }])).toBe("日常  沉默不回答");
    expect(joinSyllables([{ Text: "很", IsPartOfWord: false }, { Text: "好" }])).toBe("很 好");
    expect(joinSyllables([{ Text: "很", IsPartOfWord: true }, { Text: "好" }])).toBe("很好");
    const rows = shareLines("Line", [
      { Text: "也只能當作消遣吧 他這樣想" },
      { Text: "日常  沉默不回答" },
    ]);
    expect(selectedText(rows, [1, 0])).toBe("也只能當作消遣吧 他這樣想\n日常  沉默不回答");
  });
  test("includes lead and background voices, skips interludes and preserves repeats", () => {
    const rows = shareLines("Syllable", [
      { Type: "Interlude" },
      {
        Lead: { StartTime: 2, Syllables: [{ Text: "Hello" }] },
        Background: [{ Syllables: [{ Text: "echo" }] }],
      },
      { Lead: { StartTime: 5, Syllables: [{ Text: "Hello" }] } },
    ]);
    expect(rows.map((row) => row.text)).toEqual(["Hello", "echo", "Hello"]);
    expect(rows[0].startTime).toBe(2);
  });
  test("copies exactly selected complete lines in source order, without metadata", () => {
    const rows = shareLines("Static", [
      { Text: "first\n\nsecond" },
      { Text: "first" },
      { Text: "last" },
    ]);
    expect(selectedLines(rows, [4, 0, 3, 0]).map((row) => row.id)).toEqual([0, 3, 4]);
    expect(selectedText(rows, [4, 0, 3])).toBe("first\nfirst\nlast");
    expect(selectedText(rows, [])).toBe("");
  });
  test("handles static, timed, romanized-only and unavailable lyrics", () => {
    expect(
      shareLines("Line", [{ Text: "原文", TransliteratedText: "yuan wen", StartTime: 3 }], true)[0]
        .text
    ).toBe("yuan wen");
    expect(
      shareLines("Static", [{ TransliteratedText: "romanized" }, { Text: "\u200b" }]).map(
        (row) => row.text
      )
    ).toEqual(["romanized"]);
    expect(shareLines("None", [])).toEqual([]);
    expect(shareLines("Line", null)).toEqual([]);
  });
});

describe("lyric sharing layout", () => {
  const measure = (text: string) =>
    Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)).length;
  test("wraps words while keeping long words and emoji graphemes intact", () => {
    expect(wrapText("hello world", 6, measure)).toEqual(["hello", "world"]);
    expect(wrapText("abcdefghij", 4, measure)).toEqual(["abcd", "efgh", "ij"]);
    expect(wrapText("👩‍👩‍👧‍👦👩‍👩‍👧‍👦👩‍👩‍👧‍👦", 2, measure)).toEqual(["👩‍👩‍👧‍👦👩‍👩‍👧‍👦", "👩‍👩‍👧‍👦"]);
    expect(wrapText("a\nb", 10, measure)).toEqual(["a", "b"]);
  });
  test("makes filenames safe on Windows without changing the song title in the image", () => {
    expect(shareFilename('A/B: "song"?\n')).toBe("A_B_ _song___ - lyrics.png");
    expect(shareFilename("...")).toBe("Lyrics - lyrics.png");
  });
});
