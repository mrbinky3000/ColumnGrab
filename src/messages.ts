// Messages exchanged between the background service worker, content script and offscreen document.
//
// Chrome delivers messages and responses as untyped values, so every receiver checks the
// payload with one of the type guards below before using it.

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

function hasType<T extends string>(msg: unknown, type: T): msg is { type: T } {
  return typeof msg === "object" && msg !== null && "type" in msg && msg.type === type;
}

export function isCopyColumnMessage(msg: unknown): msg is CopyColumnMessage {
  return (
    hasType(msg, "columngrab:copy-column") &&
    "includeHeader" in msg &&
    typeof msg.includeHeader === "boolean"
  );
}

export function isClipboardFallbackMessage(msg: unknown): msg is ClipboardFallbackMessage {
  return hasType(msg, "columngrab:clipboard-fallback") && "text" in msg && typeof msg.text === "string";
}

export function isOffscreenCopyMessage(msg: unknown): msg is OffscreenCopyMessage {
  return hasType(msg, "columngrab:offscreen-copy") && "text" in msg && typeof msg.text === "string";
}

export function isCopyResult(response: unknown): response is CopyResult {
  return (
    typeof response === "object" &&
    response !== null &&
    "ok" in response &&
    typeof response.ok === "boolean" &&
    (!("error" in response) || response.error === undefined || typeof response.error === "string")
  );
}
