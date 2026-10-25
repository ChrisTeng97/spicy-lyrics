import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { PopupModal } from "../Modal.ts";
import { getShareTrack } from "./snapshot.ts";
import { ShareRenderer, type RenderState } from "./renderer.ts";
import { shareText as t, type ShareMessage } from "./locale.ts";
import {
  selectedText,
  shareFilename,
  type ShareTrack,
  type ShareOptions,
  type ShareRatio,
} from "./model.ts";
import "./styles.css";

function ShareEditor({ track }: { track: ShareTrack }) {
  const [options, setOptions] = useState<ShareOptions>({
    selected: track.lines.slice(0, 4).map((line) => line.id),
    ratio: "3:4",
    cover: true,
    title: true,
    artist: true,
  });
  const [renderState, setRenderState] = useState<RenderState>({
    loading: true,
    error: null,
    warning: null,
    height: 1440,
    extended: false,
    playing: true,
  });
  const [message, setMessage] = useState<ShareMessage>(
    "Export freezes the background. No watermark."
  );
  const [busy, setBusy] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const editor = useRef<HTMLDivElement>(null);
  const renderer = useRef<ShareRenderer | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    const instance = new ShareRenderer(canvas.current!, track, options, setRenderState);
    renderer.current = instance;
    return () => {
      mounted.current = false;
      instance.dispose();
      renderer.current = null;
    };
  }, [track]);
  useEffect(() => {
    renderer.current?.update(options);
  }, [options]);
  useEffect(() => {
    const modal = editor.current!.closest(".sl-modal")!;
    const closeButton = modal.querySelector<HTMLButtonElement>(".sl-modal-close-btn");
    closeButton?.setAttribute("aria-label", t("Close"));
    editor.current?.querySelector<HTMLInputElement>(".sl-share-line input")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        PopupModal.hide();
      } else if (event.key === "Tab") {
        const items = Array.from(
          modal.querySelectorAll<HTMLElement>(
            "button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href]"
          )
        );
        const first = items[0],
          last = items.at(-1);
        if (
          event.shiftKey &&
          (document.activeElement === first || !modal.contains(document.activeElement))
        ) {
          event.preventDefault();
          last?.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === last || !modal.contains(document.activeElement))
        ) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, []);

  const update = (patch: Partial<ShareOptions>) => {
    setOptions((current) => ({ ...current, ...patch }));
    setMessage("Export freezes the background. No watermark.");
  };
  const copyLyrics = async () => {
    setBusy(true);
    try {
      const text = selectedText(track.lines, options.selected);
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        // Some clients cannot use the asynchronous API. The legacy copy command
        // reports success, unlike native bridges that can resolve without copying.
        const area = document.createElement("textarea");
        const previousFocus = document.activeElement as HTMLElement | null;
        area.value = text;
        area.style.cssText = "position:fixed;opacity:0;pointer-events:none";
        editor.current!.append(area);
        area.select();
        try {
          if (!document.execCommand("copy")) throw new Error("Clipboard unavailable");
        } finally {
          area.remove();
          previousFocus?.focus();
        }
      }
      if (mounted.current) setMessage("Lyrics copied.");
    } catch {
      if (mounted.current) setMessage("Could not copy the lyrics. Please try again.");
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  const exportImage = async (copy: boolean) => {
    setBusy(true);
    try {
      if (copy) {
        if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined")
          throw new Error("Clipboard unavailable");
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": renderer.current!.exportPNG() }),
        ]);
        if (mounted.current) setMessage("Image copied.");
      } else {
        const blob = await renderer.current!.exportPNG();
        if (!mounted.current) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = shareFilename(track.title);
        document.body.append(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        setMessage("PNG download started.");
      }
    } catch {
      if (mounted.current)
        setMessage(
          copy
            ? "Copy is unavailable here. Please save the PNG instead."
            : "Could not export the image. Please try again."
        );
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  const empty = options.selected.length === 0;
  const imageDisabled = empty || busy || renderState.loading || !!renderState.error;
  return (
    <div className="sl-lyrics-share" ref={editor}>
      <header className="sl-share-song">
        <strong dir="auto">{track.title}</strong>
        <span dir="auto">{track.artist}</span>
        <small>{t("This song stays in the editor when playback changes.")}</small>
      </header>
      <div className="sl-share-grid">
        <section className="sl-share-selection" aria-label={t("Select lyrics")}>
          <div className="sl-share-heading">
            <h2>{t("Select lyrics")}</h2>
            <span aria-live="polite">
              {t("{count} lines selected", { count: options.selected.length })}
            </span>
          </div>
          <div className="sl-share-selection-actions">
            <button onClick={() => update({ selected: track.lines.map((line) => line.id) })}>
              {t("Select all")}
            </button>
            <button onClick={() => update({ selected: [] })}>{t("Clear")}</button>
            <button disabled={empty || busy} onClick={copyLyrics}>
              {t("Copy lyrics")}
            </button>
          </div>
          <div className="sl-share-lines">
            {track.lines.map((line) => (
              <label className="sl-share-line" key={line.id}>
                <input
                  type="checkbox"
                  checked={options.selected.includes(line.id)}
                  onChange={(event) =>
                    update({
                      selected: event.target.checked
                        ? [...options.selected, line.id]
                        : options.selected.filter((id) => id !== line.id),
                    })
                  }
                />
                <span dir="auto">{line.text}</span>
              </label>
            ))}
          </div>
          <p className="sl-share-hint">{t("Select any lines. Original order is preserved.")}</p>
        </section>
        <section className="sl-share-editor" aria-label={t("Image preview")}>
          <div className="sl-share-ratios" role="group" aria-label={t("Ratio")}>
            <span>{t("Ratio")}</span>
            {(["1:1", "3:4", "9:16"] as ShareRatio[]).map((ratio) => (
              <button
                key={ratio}
                aria-pressed={options.ratio === ratio}
                onClick={() => update({ ratio })}
              >
                {ratio}
              </button>
            ))}
          </div>
          <div className="sl-share-metadata">
            {(
              [
                ["cover", "Cover"],
                ["title", "Title"],
                ["artist", "Artist"],
              ] as const
            ).map(([key, label]) => (
              <label key={key}>
                <input
                  type="checkbox"
                  checked={options[key]}
                  onChange={(event) => update({ [key]: event.target.checked })}
                />
                {t(label)}
              </label>
            ))}
          </div>
          <button
            className="sl-share-motion"
            disabled={renderState.loading || !!renderState.warning}
            aria-pressed={!renderState.playing}
            onClick={() => renderer.current?.setPlaying(!renderState.playing)}
          >
            {t(renderState.playing ? "Freeze background" : "Animate background")}
          </button>
          <div className="sl-share-export">
            <button disabled={imageDisabled} onClick={() => exportImage(true)}>
              {t("Copy image")}
            </button>
            <button
              className="sl-share-primary"
              disabled={imageDisabled}
              onClick={() => exportImage(false)}
            >
              {t("Save PNG")}
            </button>
          </div>
          <p className="sl-share-status" role="status">
            {t(renderState.loading ? "Preparing cover and fonts…" : message)}
          </p>
          <div className="sl-share-preview" data-empty={empty || !!renderState.error}>
            <canvas
              ref={canvas}
              role="img"
              aria-label={t("{count} lines selected", { count: options.selected.length })}
            />
            {empty && <p>{t("Select a few lyrics to get started.")}</p>}
            {renderState.error && <p role="alert">{t(renderState.error)}</p>}
          </div>
          {!empty && !renderState.error && (
            <div className="sl-share-dimensions">
              <span>1080 × {renderState.height} px</span>
              {renderState.extended && <span>{t("Extended to fit all selected lyrics")}</span>}
            </div>
          )}
          {renderState.warning && (
            <p className="sl-share-hint" role="status">
              {t(renderState.warning)}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

export function openLyricsShare() {
  const track = getShareTrack();
  if (!track) {
    Spicetify.showNotification(t("No lyrics available for this song yet."));
    return;
  }
  const previousFocus = document.activeElement as HTMLElement | null;
  const container = document.createElement("div");
  const root = createRoot(container);
  PopupModal.display({
    title: t("Share lyrics"),
    content: container,
    isLarge: true,
    modalId: "lyrics-share",
    onClose: () => {
      root.unmount();
      if (previousFocus?.isConnected) previousFocus.focus();
    },
  });
  flushSync(() => root.render(<ShareEditor track={track} />));
}
