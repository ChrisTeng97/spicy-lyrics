import Kawarp from "@kawarp/core";
import { KawarpOptionsStatic } from "../DynamicBG/options.ts";
import isRtl from "../../utils/Lyrics/isRtl.ts";
import {
  IMAGE_WIDTH,
  LYRIC_SIZE,
  LINE_HEIGHT,
  MAX_IMAGE_HEIGHT,
  ratioHeights,
  selectedLines,
  wrapText,
  type ShareOptions,
  type ShareTrack,
} from "./model.ts";
import type { ShareMessage } from "./locale.ts";

export interface RenderState {
  loading: boolean;
  error: ShareMessage | null;
  warning: ShareMessage | null;
  height: number;
  extended: boolean;
  playing: boolean;
}

/** An independent renderer: changing tracks in the player cannot replace this cover. */
export class ShareRenderer {
  private background = document.createElement("canvas");
  private tinted = document.createElement("canvas");
  private foreground = document.createElement("canvas");
  private cover: ImageBitmap | HTMLCanvasElement | null = null;
  private kawarp: Kawarp | null = null;
  private abort = new AbortController();
  private disposed = false;
  private raf = 0;
  private time = 32;
  private lastTime = 0;
  private lastPaint = 0;
  private reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  private options: ShareOptions;
  private status: RenderState = {
    loading: true,
    error: null,
    warning: null,
    height: 1440,
    extended: false,
    playing: !this.reducedMotion.matches,
  };

  constructor(
    private canvas: HTMLCanvasElement,
    private track: ShareTrack,
    options: ShareOptions,
    private changed: (state: RenderState) => void
  ) {
    this.options = options;
    this.reducedMotion.addEventListener("change", this.onReducedMotion);
    this.layout();
    void this.prepare();
    this.raf = requestAnimationFrame(this.tick);
  }

  private onReducedMotion = () => {
    if (this.reducedMotion.matches) this.setPlaying(false);
  };
  private notify() {
    if (!this.disposed) this.changed({ ...this.status });
  }
  private font(ctx: CanvasRenderingContext2D, size: number, weight = 700) {
    ctx.font = `${weight} ${size}px ${this.track.fontFamily}`;
  }

  private async loadCover(): Promise<ImageBitmap | HTMLCanvasElement | null> {
    const uri = this.track.coverUri;
    if (!uri) return null;
    const timer = setTimeout(() => this.abort.abort(), 8000);
    try {
      if (uri.startsWith("spotify:local")) {
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          const cancel = () => {
            img.src = "";
            reject(new Error("Cover loading cancelled"));
          };
          img.onload = () => {
            this.abort.signal.removeEventListener("abort", cancel);
            resolve();
          };
          img.onerror = () => {
            this.abort.signal.removeEventListener("abort", cancel);
            reject(new Error("Cover unavailable"));
          };
          this.abort.signal.addEventListener("abort", cancel, { once: true });
          img.src = uri;
        });
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 640;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, 640, 640);
        // Reject a tainted source here, before it can contaminate the export canvas.
        ctx.getImageData(0, 0, 1, 1);
        return canvas;
      }
      const url = uri.replace(/^spotify:image:/, "https://i.scdn.co/image/");
      const response = await fetch(url, { signal: this.abort.signal, credentials: "omit" });
      if (!response.ok) return null;
      return await createImageBitmap(await response.blob());
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  private async prepare() {
    const cover = await this.loadCover();
    if (this.disposed) {
      if (cover instanceof ImageBitmap) cover.close();
      return;
    }
    this.cover = cover;
    if (cover) {
      try {
        this.kawarp = new Kawarp(this.background, {
          ...KawarpOptionsStatic,
          transitionDuration: 0,
        });
        this.kawarp.loadImageElement(cover);
      } catch {
        this.kawarp?.dispose();
        this.kawarp = null;
        this.status.warning = "Animation unavailable. A blurred cover will be used.";
      }
    } else this.status.warning = "Cover unavailable. A plain background will be used.";
    if (!this.kawarp) this.status.playing = false;
    // Export uses the same loaded fonts as the lyric page; do not block forever on an unrelated font.
    await Promise.race([document.fonts.ready, new Promise((resolve) => setTimeout(resolve, 3000))]);
    if (this.disposed) return;
    this.status.loading = false;
    this.layout();
    void document.fonts.ready.then(() => {
      if (!this.disposed) this.layout();
    });
  }

  update(options: ShareOptions) {
    this.options = options;
    this.layout();
  }
  setPlaying(playing: boolean) {
    this.status.playing = !!this.kawarp && playing;
    this.lastTime = 0;
    this.notify();
  }

  private layout() {
    if (this.disposed) return;
    const selected = selectedLines(this.track.lines, this.options.selected);
    const ctx = this.foreground.getContext("2d")!;
    const pad = 88,
      textWidth = IMAGE_WIDTH - 2 * pad;
    this.font(ctx, LYRIC_SIZE);
    let previous = -1,
      total = 0;
    const rows = selected.map((line) => {
      const gap = previous >= 0 && line.id > previous + 1 ? LINE_HEIGHT * 0.55 : 0;
      previous = line.id;
      const text = wrapText(line.text, textWidth, (value) => ctx.measureText(value).width);
      total += gap + text.length * LINE_HEIGHT;
      return { text, gap, rtl: isRtl(line.text) };
    });
    const showCover = this.options.cover && !!this.cover;
    const infoWidth = textWidth - (showCover ? 210 : 0);
    this.font(ctx, 40, 600);
    const title = this.options.title
      ? wrapText(this.track.title, infoWidth, (s) => ctx.measureText(s).width)
      : [];
    this.font(ctx, 28, 400);
    const artist = this.options.artist
      ? wrapText(this.track.artist, infoWidth, (s) => ctx.measureText(s).width)
      : [];
    const infoHeight =
      title.length * 56 + (title.length && artist.length ? 9 : 0) + artist.length * 40;
    const metaHeight = Math.max(showCover ? 180 : 0, infoHeight);
    const height = Math.ceil(
      Math.max(
        ratioHeights[this.options.ratio],
        total + pad * 2 + (metaHeight ? metaHeight + 80 : 0)
      )
    );
    this.status.error =
      height > MAX_IMAGE_HEIGHT ? "Too many lyrics for one image. Select fewer lines." : null;
    this.status.height = height;
    this.status.extended = height > ratioHeights[this.options.ratio];
    if (this.status.error) {
      this.notify();
      return;
    }
    this.canvas.width = this.foreground.width = IMAGE_WIDTH;
    this.canvas.height = this.foreground.height = height;
    const bgHeight = Math.ceil(height / 3);
    if (this.background.width !== 360 || this.background.height !== bgHeight) {
      this.background.width = this.tinted.width = 360;
      this.background.height = this.tinted.height = bgHeight;
      this.kawarp?.resize();
    }
    ctx.textBaseline = "top";
    ctx.fillStyle = "#f7f8ef";
    this.font(ctx, LYRIC_SIZE);
    const contentBottom = height - pad - (metaHeight ? metaHeight + 80 : 0);
    let y = pad + Math.max(0, (contentBottom - pad - total) / 2);
    rows.forEach((row) => {
      y += row.gap;
      ctx.direction = row.rtl ? "rtl" : "ltr";
      ctx.textAlign = row.rtl ? "right" : "left";
      row.text.forEach((text) => {
        ctx.fillText(text, row.rtl ? IMAGE_WIDTH - pad : pad, y);
        y += LINE_HEIGHT;
      });
    });
    const metaY = height - pad - metaHeight;
    if (showCover) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(pad, metaY + (metaHeight - 180) / 2, 180, 180, 16);
      ctx.clip();
      ctx.drawImage(this.cover!, pad, metaY + (metaHeight - 180) / 2, 180, 180);
      ctx.restore();
    }
    y = metaY + (metaHeight - infoHeight) / 2;
    const infoX = pad + (showCover ? 210 : 0);
    const drawInfo = (
      text: string[],
      size: number,
      weight: number,
      spacing: number,
      color: string,
      rtl: boolean
    ) => {
      this.font(ctx, size, weight);
      ctx.fillStyle = color;
      ctx.direction = rtl ? "rtl" : "ltr";
      ctx.textAlign = rtl ? "right" : "left";
      text.forEach((row) => {
        ctx.fillText(row, rtl ? IMAGE_WIDTH - pad : infoX, y);
        y += spacing;
      });
    };
    drawInfo(title, 40, 600, 56, "#ffffff", isRtl(this.track.title));
    if (title.length && artist.length) y += 9;
    drawInfo(artist, 28, 400, 40, "#d5e2dc", isRtl(this.track.artist));
    this.paint();
    this.notify();
  }

  private paint() {
    if (this.disposed || this.status.error) return;
    const ctx = this.canvas.getContext("2d")!,
      height = this.canvas.height;
    ctx.fillStyle = "#173a43";
    ctx.fillRect(0, 0, IMAGE_WIDTH, height);
    if (this.kawarp) {
      this.kawarp.renderFrame(this.time);
      const tinted = this.tinted.getContext("2d")!;
      tinted.clearRect(0, 0, this.tinted.width, this.tinted.height);
      tinted.filter = "saturate(2.5) brightness(0.65)";
      tinted.drawImage(this.background, 0, 0);
      tinted.filter = "none";
      ctx.drawImage(this.tinted, 0, 0, IMAGE_WIDTH, height);
    } else if (this.cover) {
      ctx.save();
      ctx.filter = "blur(64px) saturate(1.5) brightness(0.55)";
      ctx.drawImage(this.cover, -120, -120, IMAGE_WIDTH + 240, height + 240);
      ctx.restore();
    }
    ctx.drawImage(this.foreground, 0, 0);
  }

  private tick = (now: number) => {
    if (this.disposed) return;
    const dt = this.lastTime ? Math.min((now - this.lastTime) / 1000, 0.1) : 0;
    this.lastTime = now;
    if (
      this.status.playing &&
      !document.hidden &&
      !this.status.loading &&
      !this.status.error &&
      this.options.selected.length
    ) {
      this.time += dt;
      if (now - this.lastPaint >= 50) {
        this.lastPaint = now;
        this.paint();
      }
    }
    this.raf = requestAnimationFrame(this.tick);
  };

  exportPNG(): Promise<Blob> {
    if (this.disposed || this.status.loading || this.status.error || !this.options.selected.length)
      return Promise.reject(new Error("Image not ready"));
    this.setPlaying(false);
    this.paint();
    return new Promise((resolve, reject) => {
      this.canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("PNG encoding failed"))),
        "image/png"
      );
    });
  }

  dispose() {
    this.disposed = true;
    this.abort.abort();
    cancelAnimationFrame(this.raf);
    this.reducedMotion.removeEventListener("change", this.onReducedMotion);
    this.kawarp?.dispose();
    if (this.cover instanceof ImageBitmap) this.cover.close();
    for (const canvas of [this.background, this.tinted, this.foreground])
      canvas.width = canvas.height = 1;
  }
}
