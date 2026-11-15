// ColumnGrab service worker: context menu wiring + clipboard fallback.
import {
  isClipboardFallbackMessage,
  isCopyResult,
  type CopyColumnMessage,
  type CopyResult,
  type CopyTableMessage,
  type OffscreenCopyMessage,
} from "./messages";

const MENU_WITH_HEADER = "columngrab-copy-column";
const MENU_NO_HEADER = "columngrab-copy-column-no-header";
const MENU_TABLE = "columngrab-copy-table";
const { ContextType } = chrome.contextMenus;

const MENU_CONTEXTS: [chrome.contextMenus.ContextType, ...chrome.contextMenus.ContextType[]] = [
  ContextType.PAGE,
  ContextType.SELECTION,
  ContextType.LINK,
  ContextType.IMAGE,
];

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    // Several top-level items: Chrome nests them under a "ColumnGrab" submenu automatically.
    chrome.contextMenus.create({
      id: MENU_WITH_HEADER,
      title: "Copy this table column",
      contexts: MENU_CONTEXTS,
    });
    chrome.contextMenus.create({
      id: MENU_NO_HEADER,
      title: "Copy this table column (without header)",
      contexts: MENU_CONTEXTS,
    });
    chrome.contextMenus.create({
      id: MENU_TABLE,
      title: "Copy this whole table",
      contexts: MENU_CONTEXTS,
    });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (tab?.id === undefined) return;

  let message: CopyColumnMessage | CopyTableMessage;

  if (info.menuItemId === MENU_TABLE) message = { type: "columngrab:copy-table" };
  else if (info.menuItemId === MENU_WITH_HEADER || info.menuItemId === MENU_NO_HEADER) {
    message = { type: "columngrab:copy-column", includeHeader: info.menuItemId === MENU_WITH_HEADER };
  } else return;

  chrome.tabs.sendMessage(tab.id, message, { frameId: info.frameId ?? 0 }).catch(() => {
    // Content script not present (tab was open before install, or a restricted page like chrome://).
  });
});

// Toolbar button opens the settings.
chrome.action.onClicked.addListener(() => {
  void chrome.runtime.openOptionsPage();
});

// Fallback clipboard path: if the page blocks clipboard access (e.g. a cross-origin iframe
// without clipboard-write permission), the content script hands the text to us and we copy
// it from an offscreen document.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse: (r: CopyResult) => void) => {
  if (!isClipboardFallbackMessage(msg)) return;
  copyViaOffscreen(msg.text)
    .then(() => sendResponse({ ok: true }))
    .catch((cause: unknown) => sendResponse({ ok: false, error: String(cause) }));

  return true; // async response
});

async function copyViaOffscreen(text: string): Promise<void> {
  const url = chrome.runtime.getURL("offscreen.html");

  const existing = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
    documentUrls: [url],
  });

  if (existing.length === 0) {
    await chrome.offscreen.createDocument({
      url: "offscreen.html",
      reasons: [chrome.offscreen.Reason.CLIPBOARD],
      justification: "Write the copied table column to the clipboard.",
    });
  }

  const message: OffscreenCopyMessage = { type: "columngrab:offscreen-copy", text };
  const res = await chrome.runtime.sendMessage<OffscreenCopyMessage, unknown>(message);

  if (!isCopyResult(res)) throw new Error("Offscreen document sent an invalid response");

  if (!res.ok) throw new Error(res.error ?? "Offscreen copy failed");
}
