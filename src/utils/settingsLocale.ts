import zhCN from "../locales/settings/zh-CN.json";

export type SettingsLocale = "en" | "zh-CN";
export type SettingsLanguage = "auto" | SettingsLocale;

/** Unknown preferences and unsupported locales retain the English fallback. */
export function resolveSettingsLocale(preference: string, appLocale = "en"): SettingsLocale {
  if (preference === "zh-CN" || preference === "en") return preference;
  if (preference !== "auto") return "en";
  return /^zh(?:$|[-_](?:CN|SG|Hans)(?:$|[-_]))/i.test(appLocale) ? "zh-CN" : "en";
}

/** English source messages are the fallback, including unknown remote experiment copy. */
export function translateSettings(
  message: string,
  locale: SettingsLocale,
  values: Record<string, string | number> = {}
): string {
  const translated =
    locale === "zh-CN" && Object.hasOwn(zhCN, message)
      ? (zhCN as Record<string, string>)[message]
      : message;
  return translated.replace(/\{(\w+)\}/g, (placeholder, key: string) =>
    Object.hasOwn(values, key) ? String(values[key]) : placeholder
  );
}

/** Extra terms describe intent without changing the visible labels. */
export const settingsSearchKeywords: Record<string, string> = {
  "experiment:lineOnlyLyrics":
    "逐行 整行 按行 逐字 动效 动画 逐字动效 逐字动画 line by line line-by-line whole line line sync word by word karaoke animation effects",
  "experiment:clearLyrics":
    "清晰 模糊 不模糊 虚化 blur blurry blur-free no blur sharp clear readability",
  "experiment:noLyricsGlow": "泛光 发光 光晕 光效 辉光 glow glowing bloom halo shine shadow",
  simpleLyricsMode: "简洁 特效 动效 动画",
  minimalLyricsMode: "极简 隐藏 已唱",
  playbackOffset: "同步 延迟 提前 滞后 偏移",
  smoothScrolling: "滚动 平滑",
  animationFpsCapEnabled: "性能 帧率 动画 卡顿 fps",
  settingsLanguage:
    "语言 中文 英文 简体 language locale localization translation English Chinese simplified automatic",
  backgroundStyle: "背景 封面 透明 动态",
};
