"use client";

import { useState, useEffect, useCallback } from "react";
import { Settings, DEFAULT_SETTINGS } from "@/lib/types";
import { getSettings, saveSettings } from "@/lib/storage";

function hasNonDefaultSettings(s: Settings): boolean {
  return s.geminiApiKey !== "" || s.qwenApiKey !== "" || s.dashscopeApiKey !== "" ||
    s.textProvider !== DEFAULT_SETTINGS.textProvider || s.modelName !== DEFAULT_SETTINGS.modelName ||
    s.mentorUseShared !== DEFAULT_SETTINGS.mentorUseShared;
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // 1. Fast load from localStorage
    const local = getSettings();
    setSettings(local);
    setLoaded(true);

    // 2. Hydrate from server
    fetch("/api/data/settings")
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data && Object.keys(data).length > 0) {
          const merged = { ...DEFAULT_SETTINGS, ...data };
          setSettings(merged);
          saveSettings(merged); // sync back to localStorage
        } else if (hasNonDefaultSettings(local)) {
          // Server has no settings but localStorage does — push to server
          fetch("/api/data/settings", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(local),
          }).catch(() => {});
        }
      })
      .catch(() => { /* use localStorage fallback */ });
  }, []);

  const update = useCallback(
    (partial: Partial<Settings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...partial };
        saveSettings(next);
        // Fire-and-forget server sync
        fetch("/api/data/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next),
        }).catch(() => { /* silent fallback */ });
        return next;
      });
    },
    []
  );

  const reset = useCallback(() => {
    setSettings((prev) => {
      const next = {
        ...DEFAULT_SETTINGS,
        geminiApiKey: prev.geminiApiKey,
        qwenApiKey: prev.qwenApiKey,
        dashscopeApiKey: prev.dashscopeApiKey,
      };
      saveSettings(next);
      fetch("/api/data/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      }).catch(() => {});
      return next;
    });
  }, []);

  return { settings, update, reset, loaded };
}
