// User preferences, stored in chrome.storage.sync.

export type Modifier = "alt" | "alt+shift" | "ctrl+alt";

export interface Settings {
  /** Key combination held while dragging down a column. */
  modifier: Modifier;
  /** Drop empty cells from the copied output. */
  trimEmpty: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  modifier: "alt",
  trimEmpty: false,
};

export async function loadSettings(): Promise<Settings> {
  const stored = await chrome.storage.sync.get<Settings>(DEFAULT_SETTINGS);
  return { ...DEFAULT_SETTINGS, ...stored };
}

export function saveSettings(patch: Partial<Settings>): Promise<void> {
  return chrome.storage.sync.set(patch);
}
