"use client";

import { useState, useEffect, useCallback } from "react";
import { Settings, DEFAULT_SETTINGS } from "@/lib/types";
import { getSettings, saveSettings } from "@/lib/storage";

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setSettings(getSettings());
    setLoaded(true);
  }, []);

  const update = useCallback(
    (partial: Partial<Settings>) => {
      const next = { ...settings, ...partial };
      setSettings(next);
      saveSettings(next);
    },
    [settings]
  );

  const reset = useCallback(() => {
    const next = {
      ...DEFAULT_SETTINGS,
      geminiApiKey: settings.geminiApiKey,
      qwenApiKey: settings.qwenApiKey,
      dashscopeApiKey: settings.dashscopeApiKey,
    };
    setSettings(next);
    saveSettings(next);
  }, [settings.geminiApiKey, settings.qwenApiKey, settings.dashscopeApiKey]);

  return { settings, update, reset, loaded };
}
