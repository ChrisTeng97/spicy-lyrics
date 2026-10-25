import { useStore } from "@nanostores/react";
import { $settingsLanguage } from "../../../utils/stores.ts";
import { resolveSettingsLocale, translateSettings } from "../../../utils/settingsLocale.ts";

export function getSettingsLocale() {
  return resolveSettingsLocale(
    $settingsLanguage.get(),
    Spicetify.Locale?.getLocale?.() ?? navigator.language
  );
}

export function useSettingsTranslation() {
  useStore($settingsLanguage);
  const locale = getSettingsLocale();
  return {
    locale,
    t: (message: string, values?: Record<string, string | number>) =>
      translateSettings(message, locale, values),
  };
}
