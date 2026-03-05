"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface UserInfo {
  id: string;
  username: string;
  role: "admin" | "member";
}

const UserContext = createContext<UserInfo | null>(null);

const MIGRATION_KEY = "gongkao_migrated_v1";

function runOneTimeMigration() {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(MIGRATION_KEY)) return;

  const keys = [
    ["gongkao_settings", "settings"],
    ["gongkao_history", "history"],
    ["gongkao_question_bank", "questionBank"],
    ["gongkao_exam_papers", "examPapers"],
    ["gongkao_exam_sessions", "examSessions"],
    ["gongkao_mentor_evals", "mentorEvals"],
  ] as const;

  const migrationData: Record<string, unknown> = {};
  for (const [lsKey, bodyKey] of keys) {
    const raw = localStorage.getItem(lsKey);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && (Array.isArray(parsed) ? parsed.length > 0 : Object.keys(parsed).length > 0)) {
          migrationData[bodyKey] = parsed;
        }
      } catch { /* skip */ }
    }
  }

  if (Object.keys(migrationData).length > 0) {
    fetch("/api/data/migrate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(migrationData),
    })
      .then((res) => {
        if (res.ok) localStorage.setItem(MIGRATION_KEY, Date.now().toString());
      })
      .catch(() => { /* retry next load */ });
  } else {
    localStorage.setItem(MIGRATION_KEY, Date.now().toString());
  }
}

export function UserProvider({ initial, children }: { initial: UserInfo | null; children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(initial);

  // Also check for user info stored in localStorage (set after login)
  useEffect(() => {
    if (!user) {
      const stored = localStorage.getItem("gongkao_user");
      if (stored) {
        try { setUser(JSON.parse(stored)); } catch { /* ignore */ }
      }
    }
  }, [user]);

  // One-time migration: push localStorage data to server DB
  useEffect(() => {
    if (user) runOneTimeMigration();
  }, [user]);

  return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
}

export function useUser() {
  return useContext(UserContext);
}
