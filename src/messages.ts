// Messages exchanged between the background service worker, content script and offscreen document.

/** Background → content script: copy the column of the last right-clicked cell. */
export interface CopyColumnMessage {
  type: "columngrab:copy-column";
  includeHeader: boolean;
}

/** Content script → background: page blocked clipboard access, please copy this for me. */
export interface ClipboardFallbackMessage {
  type: "columngrab:clipboard-fallback";
  text: string;
}

/** Background → offscreen document: write this text to the clipboard. */
export interface OffscreenCopyMessage {
  type: "columngrab:offscreen-copy";
  text: string;
}

export interface CopyResult {
  ok: boolean;
  error?: string;
}

/** Narrow an unknown runtime message to one of ours by its `type` tag. */
export function isMessage<T extends { type: string }>(msg: unknown, type: T["type"]): msg is T {
  return typeof msg === "object" && msg !== null && (msg as { type?: unknown }).type === type;
}
