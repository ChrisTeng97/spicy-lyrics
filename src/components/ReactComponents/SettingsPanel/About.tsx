import { useSettingsTranslation } from "./locale.ts";
import { useStore } from "@nanostores/react";
import React, { useEffect, useState } from "react";
import Session from "../../Global/Session.ts";
import App from "../../../utils/app.ts";
import { $spicyLyricsVersion } from "../../../utils/stores.ts";
import { ForkRepository } from "../../../../project/config.ts";

interface Link {
  label: string;
  url: string;
  /** Platform tint, as an "r, g, b" triplet. Omitted for the neutral treatment. */
  brand?: string;
}

const LINKS: Link[] = [
  { label: "Fork / installation", url: `${ForkRepository}#installation` },
  { label: "Website", url: "https://spicylyrics.org" },
  { label: "Discord", url: "https://discord.com/invite/uqgXU5wh8j", brand: "88, 101, 242" },
  { label: "Ko-fi", url: "https://ko-fi.com/spikerko", brand: "255, 94, 138" },
];

/** "checking" until the fetch lands; "unknown" if it never does. */
export type UpdateStatus = "checking" | "latest" | "outdated" | "unknown";

interface Version {
  Major: number;
  Minor: number;
  Patch: number;
}

/** Ordered compare — Minor only decides once Major ties, and Patch once both do. */
function isNewer(a: Version, b: Version): boolean {
  if (a.Major !== b.Major) return a.Major > b.Major;
  if (a.Minor !== b.Minor) return a.Minor > b.Minor;
  return a.Patch > b.Patch;
}

/** Checks once per mount. The panel owns it, so the sidebar can flag an update too. */
export function useUpdateStatus(): UpdateStatus {
  const [status, setStatus] = useState<UpdateStatus>("checking");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const latest = await Session.SpicyLyrics.GetLatestVersion();
        const current = Session.SpicyLyrics.GetCurrentVersion();
        if (cancelled) return;
        // Either side missing means the check didn't conclude — saying
        // "Latest" there would be a guess dressed up as a fact.
        if (!latest || !current) {
          setStatus("unknown");
          return;
        }
        setStatus(isNewer(latest, current) ? "outdated" : "latest");
      } catch {
        if (!cancelled) setStatus("unknown");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return status;
}

function ExternalArrow() {
  return (
    <svg
      className="sl-sp-about-arrow"
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M2.5 7.5L7.5 2.5M7.5 2.5H3.5M7.5 2.5V6.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function About({ status }: { status: UpdateStatus }) {
  const { t } = useSettingsTranslation();
  const version = useStore($spicyLyricsVersion);
  const build = App.isDev() ? "dev" : "ChrisTeng97 fork";

  return (
    <div className="sl-sp-about">
      <div className="sl-sp-about-hero">
        <span className="sl-sp-about-wordmark">Spicy Lyrics</span>
        <div className="sl-sp-about-status-row">
          <span className="sl-sp-about-version">{t("Version {version}", { version })}</span>
          {(status === "latest" || status === "outdated") && (
            <>
              <span className="sl-sp-about-sep" aria-hidden="true">
                ·
              </span>
              <span className={`sl-sp-about-status sl-sp-about-status--${status}`}>
                {t(status === "latest" ? "Up to date" : "Update available")}
              </span>
            </>
          )}
          {status === "outdated" && (
            <button
              type="button"
              className="sl-sp-about-update"
              onClick={() => Session.Navigate({ pathname: "/SpicyLyrics/Update" })}
            >
              {t("Update")}
            </button>
          )}
        </div>
        <span className="sl-sp-about-build">
          {t("Build")} <span className="sl-sp-about-build-value">{t(build)}</span>
        </span>
        <p>{t("This fork uses manual updates. Download updates from the fork installation page.")}</p>
      </div>

      <div className="sl-sp-about-links">
        {LINKS.map(({ label, url, brand }) => (
          <button
            key={label}
            type="button"
            className={`sl-sp-about-link${brand ? " sl-sp-about-link--brand" : ""}`}
            style={brand ? ({ "--brand": brand } as React.CSSProperties) : undefined}
            onClick={() => window.open(url, "_blank")}
          >
            <span>{t(label)}</span>
            <ExternalArrow />
          </button>
        ))}
      </div>
    </div>
  );
}
