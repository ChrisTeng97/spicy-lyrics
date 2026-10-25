/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import {
  matchesLabel,
  matchesSetting,
  searchTerms,
} from "../src/components/ReactComponents/SettingsPanel/model.ts";
import { resolveSettingsLocale, translateSettings } from "../src/utils/settingsLocale.ts";

describe("settings language", () => {
  test("missing-lyrics supplementation is searchable in both languages", () => {
    const setting = { id: "experiment:neteaseFallback", label: "NetEase Missing Lyrics" };
    for (const query of ["网易云", "补词", "歌词来源", "netease", "missing lyrics", "fallback", "local cache"]) {
      expect(matchesSetting(query, setting)).toBe(true);
    }
  });
  test("lyric sharing is searchable in both languages", () => {
    const setting = { id: "experiment:lyricSharing", label: "Lyric Sharing", description: "Select lyric lines to copy as text or export as an image with an animated cover background." };
    for (const query of ["歌词分享", "复制歌词", "复制文字", "导出", "share", "copy text", "png", "poster"]) {
      expect(matchesSetting(query, setting)).toBe(true);
    }
  });
  test("explicit language overrides Spotify and automatic selection falls back safely", () => {
    expect(resolveSettingsLocale("en", "zh-CN")).toBe("en");
    expect(resolveSettingsLocale("zh-CN", "en-US")).toBe("zh-CN");
    for (const tag of ["zh", "zh-CN", "zh_SG", "zh-Hans", "zh-Hans-CN"]) {
      expect(resolveSettingsLocale("auto", tag)).toBe("zh-CN");
    }
    for (const tag of ["en", "de", "zh-TW", "zh-Hant-HK"]) {
      expect(resolveSettingsLocale("auto", tag)).toBe("en");
    }
    expect(resolveSettingsLocale("invalid", "zh-CN")).toBe("en");
  });

  test("interpolates translated messages without treating values as replacement patterns", () => {
    expect(translateSettings("{count} settings", "zh-CN", { count: 3 })).toBe("3 项设置");
    expect(translateSettings("No results for “{query}”", "zh-CN", { query: "$& <test>" })).toBe(
      "没有找到与“$& <test>”匹配的设置"
    );
    expect(translateSettings("Unknown remote label", "zh-CN")).toBe("Unknown remote label");
    expect(translateSettings("constructor", "zh-CN")).toBe("constructor");
    expect(translateSettings("Lyrics", "en")).toBe("Lyrics");
  });
});

describe("bilingual settings search", () => {
  const lineOnly = {
    id: "experiment:lineOnlyLyrics",
    label: "Line-only Lyrics",
    description:
      "Highlight each active line all at once, without word-by-word fill, bounce or letter effects. Keep automatic scrolling and duet alignment. Disable to restore word-synced effects.",
    keywords: "experiment",
  };
  const background = { id: "backgroundStyle", label: "Background", description: "Cover Art" };
  const clear = { id: "experiment:clearLyrics", label: "Clear Lyrics" };

  test("finds translated labels, descriptions and intent aliases", () => {
    for (const query of [
      "逐行",
      "整行",
      "对唱",
      "逐字",
      "动效",
      "逐字动画",
      "word by word",
      "逐行 bounce",
    ]) {
      expect(matchesSetting(query, lineOnly)).toBe(true);
    }
    expect(matchesSetting("不模糊", clear)).toBe(true);
    expect(matchesSetting("清晰", clear)).toBe(true);
    const glow = { id: "experiment:noLyricsGlow", label: "Disable Lyrics Glow" };
    for (const query of ["泛光", "发光", "光晕", "glow"]) {
      expect(matchesSetting(query, glow)).toBe(true);
    }
    expect(matchesSetting("封面", background)).toBe(true);
    expect(matchesSetting("逐行 background", lineOnly)).toBe(false);
  });

  test("keeps English search and label-first ranking", () => {
    expect(matchesSetting("LINE-ONLY", lineOnly)).toBe(true);
    expect(matchesLabel("逐行", lineOnly)).toBe(true);
    expect(matchesLabel("对唱", lineOnly)).toBe(false);
    expect(matchesSetting("unknown", lineOnly)).toBe(false);
    expect(matchesSetting("   ", lineOnly)).toBe(true);
  });

  test("finds every added preference by English names and intent aliases", () => {
    const cases = [
      {
        setting: lineOnly,
        queries: ["line only", "line by line", "line-by-line", "whole line", "animation"],
      },
      { setting: clear, queries: ["clear lyrics", "no blur", "blurry", "sharp"] },
      {
        setting: { id: "experiment:noLyricsGlow", label: "Disable Lyrics Glow" },
        queries: ["disable glow", "bloom", "halo", "shadow"],
      },
      {
        setting: { id: "settingsLanguage", label: "Settings Language" },
        queries: ["language", "locale", "translation", "English", "Chinese"],
      },
    ];
    for (const { setting, queries } of cases) {
      for (const query of queries) expect(matchesSetting(query, setting)).toBe(true);
    }
  });

  test("normalizes full-width input and whitespace without regex interpretation", () => {
    expect(searchTerms("  ＦＰＳ　帧率 ")).toEqual(["fps", "帧率"]);
    expect(matchesSetting("ＬＩＮＥ", lineOnly)).toBe(true);
    expect(matchesSetting(".*", lineOnly)).toBe(false);
  });
});
