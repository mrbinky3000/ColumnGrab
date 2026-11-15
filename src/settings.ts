// User preferences, stored in chrome.storage.sync.

const MODIFIERS = ["alt", "alt+shift", "ctrl+alt"] as const;

export type Modifier = (typeof MODIFIERS)[number];

const MODIFIER_SET: ReadonlySet<string> = new Set(MODIFIERS);

export function isModifier(value: unknown): value is Modifier {
  return typeof value === "string" && MODIFIER_SET.has(value);
}

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

/**
 * Read the settings, checking each stored value. A missing or invalid value (left by an
 * older version, say) falls back to its default, so callers can trust the result: the
 * content script looks up `modifier` as an object key on every keypress and click.
 */
export async function loadSettings(): Promise<Settings> {
  // Typed as Settings by the storage API, but whatever was saved comes back as is.
  const stored = await chrome.storage.sync.get<Settings>(DEFAULT_SETTINGS);

  return {
    modifier: isModifier(stored.modifier) ? stored.modifier : DEFAULT_SETTINGS.modifier,
    trimEmpty: isBoolean(stored.trimEmpty) ? stored.trimEmpty : DEFAULT_SETTINGS.trimEmpty,
  };
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

export function saveSettings(patch: Partial<Settings>): Promise<void> {
  return chrome.storage.sync.set(patch);
}
