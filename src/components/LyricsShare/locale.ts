import { getSettingsLocale } from "../ReactComponents/SettingsPanel/locale.ts";

const messages = {
  "Share lyrics": "分享歌词",
  "Select lyrics": "选择歌词",
  "Select all": "全选",
  Clear: "清空",
  "{count} lines selected": "已选 {count} 行",
  "Select any lines. Original order is preserved.": "可以跨行勾选，按原顺序排列。",
  "This song stays in the editor when playback changes.": "切歌后，这里的歌曲和歌词保持不变。",
  "Image preview": "图片预览",
  Ratio: "比例",
  Cover: "封面",
  Title: "歌名",
  Artist: "歌手",
  "Freeze background": "定格背景",
  "Animate background": "播放背景",
  "Select a few lyrics to get started.": "先选几句喜欢的歌词。",
  "Extended to fit all selected lyrics": "已自动延长为长图",
  "Save PNG": "保存 PNG",
  "Copy image": "复制图片",
  "Copy lyrics": "复制歌词",
  "Lyrics copied.": "歌词已复制。",
  "Could not copy the lyrics. Please try again.": "歌词复制失败，请重试。",
  "Export freezes the background. No watermark.": "导出会定格当前背景，无额外水印。",
  "Preparing cover and fonts…": "正在准备封面和字体…",
  "Cover unavailable. A plain background will be used.": "封面暂时无法读取，将使用纯色背景。",
  "Animation unavailable. A blurred cover will be used.": "动态背景不可用，将使用模糊封面。",
  "Too many lyrics for one image. Select fewer lines.":
    "所选歌词超过单张图片的尺寸上限，请减少一些歌词。",
  "PNG download started.": "已发起 PNG 图片下载。",
  "Image copied.": "图片已复制。",
  "Copy is unavailable here. Please save the PNG instead.":
    "当前环境无法复制图片，请使用保存 PNG。",
  "Could not export the image. Please try again.": "图片导出失败，请重试。",
  "No lyrics available for this song yet.": "这首歌暂时没有可分享的歌词。",
  Close: "关闭",
} as const;
export type ShareMessage = keyof typeof messages;
export function shareText(message: ShareMessage, values: Record<string, string | number> = {}) {
  const text = getSettingsLocale() === "zh-CN" ? messages[message] : message;
  return text.replace(/\{(\w+)\}/g, (match, key) => String(values[key] ?? match));
}
