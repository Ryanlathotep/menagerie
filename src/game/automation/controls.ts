// Shared automation transport controls (play / pause / speed / mode).
//
// Every automation loop (Autoplay, Auto-Hunt, Auto-Search, Auto-Harvest) reads
// its step delay through `automationStepMs`, so a single speed multiplier
// drives all of them. Persisted so the chosen mode + speed survive reloads and
// stay in sync between the Overworld and Dungeon HUDs.

import { useCallback, useEffect, useState } from 'react';

export type AutomationMode = 'autoplay' | 'hunt' | 'search' | 'harvest';

export const AUTOMATION_SPEEDS = [1, 2, 4, 8] as const;
export type AutomationSpeed = (typeof AUTOMATION_SPEEDS)[number];

export const AUTOMATION_MODE_LABELS: Record<AutomationMode, string> = {
  autoplay: 'Autoplay (play for me)',
  hunt: 'Auto-Hunt (seek enemies)',
  search: 'Auto-Search (pick target)',
  harvest: 'Auto-Harvest All',
};

export const AUTOMATION_MODE_ICONS: Record<AutomationMode, string> = {
  autoplay: '🤖',
  hunt: '🏹',
  search: '🔎',
  harvest: '🧺',
};

export interface AutomationControls {
  mode: AutomationMode;
  speed: AutomationSpeed;
  /**
   * Keep the loop running through every interruption it can safely survive
   * (stair prompts, cleared enemies, empty tiles). On by default — players who
   * want confirmation prompts can turn it off, or script their own behaviour
   * with the Autoplay rules.
   */
  uninterrupted: boolean;
}

const KEY = 'ui.automation.controls.v1';
const EVENT = 'automation-controls-changed';

export const DEFAULT_AUTOMATION_CONTROLS: AutomationControls = {
  mode: 'autoplay',
  speed: 1,
  uninterrupted: true,
};

export function loadAutomationControls(): AutomationControls {
  if (typeof window === 'undefined') return DEFAULT_AUTOMATION_CONTROLS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_AUTOMATION_CONTROLS;
    const parsed = JSON.parse(raw) as Partial<AutomationControls>;
    const speed = AUTOMATION_SPEEDS.includes(parsed.speed as AutomationSpeed)
      ? (parsed.speed as AutomationSpeed)
      : 1;
    return { ...DEFAULT_AUTOMATION_CONTROLS, ...parsed, speed };
  } catch {
    return DEFAULT_AUTOMATION_CONTROLS;
  }
}

export function saveAutomationControls(next: AutomationControls) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch { /* storage full / disabled — keep in-memory value */ }
  window.dispatchEvent(new CustomEvent<AutomationControls>(EVENT, { detail: next }));
}

/** Base step delay divided by the active multiplier, floored so it stays sane. */
export function automationStepMs(baseMs: number, speed: number, floor = 40): number {
  const base = baseMs > 0 ? baseMs : 100;
  return Math.max(floor, Math.round(base / (speed || 1)));
}

export function useAutomationControls() {
  const [controls, setControls] = useState<AutomationControls>(loadAutomationControls);

  useEffect(() => {
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<AutomationControls>).detail;
      if (detail) setControls(detail);
    };
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);

  const patch = useCallback((p: Partial<AutomationControls>) => {
    setControls(prev => {
      const next = { ...prev, ...p };
      saveAutomationControls(next);
      return next;
    });
  }, []);

  const setMode = useCallback((mode: AutomationMode) => patch({ mode }), [patch]);
  const setSpeed = useCallback((speed: AutomationSpeed) => patch({ speed }), [patch]);
  const setUninterrupted = useCallback((uninterrupted: boolean) => patch({ uninterrupted }), [patch]);

  return { controls, setMode, setSpeed, setUninterrupted };
}
