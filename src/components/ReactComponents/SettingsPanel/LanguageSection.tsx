import { useStore } from "@nanostores/react";
import type { SettingsLanguage } from "../../../utils/settingsLocale.ts";
import { $settingsLanguage } from "../../../utils/stores.ts";
import { Select } from "./components.tsx";
import { LanguageIcon } from "./icons.tsx";
import type { GroupDef, SectionDef } from "./model.ts";

// Keep the control's identity stable when a language change re-renders the panel.
const groups: GroupDef[] = [
  {
    settings: [
      {
        id: "settingsLanguage",
        label: "Settings Language",
        description:
          "Choose the settings language. Search accepts both English and Chinese keywords.",
        keywords: "language locale English Chinese",
        Control: ({ label }) => (
          <Select
            label={label}
            value={useStore($settingsLanguage)}
            options={["auto", "en", "zh-CN"]}
            labels={["Follow Spotify", "English", "简体中文"]}
            onChange={(value) => $settingsLanguage.set(value as SettingsLanguage)}
          />
        ),
      },
    ],
  },
];

export const languageSection: SectionDef = {
  id: "language",
  title: "Language",
  icon: LanguageIcon,
  groups: () => groups,
};
