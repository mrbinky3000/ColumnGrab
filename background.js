// ColumnGrab service worker: context menu wiring + clipboard fallback.

const MENU_WITH_HEADER = "columngrab-copy-column";
const MENU_NO_HEADER = "columngrab-copy-column-no-header";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    // Two top-level items: Chrome nests them under a "ColumnGrab" submenu automatically.
    chrome.contextMenus.create({
      id: MENU_WITH_HEADER,
      title: "Copy this table column",
      contexts: ["page", "selection", "link", "image"],
    });
    chrome.contextMenus.create({
      id: MENU_NO_HEADER,
      title: "Copy this table column (without header)",
      contexts: ["page", "selection", "link", "image"],
    });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab?.id) return;
  if (info.menuItemId !== MENU_WITH_HEADER && info.menuItemId !== MENU_NO_HEADER) return;
  chrome.tabs
    .sendMessage(
      tab.id,
      { type: "columngrab:copy-column", includeHeader: info.menuItemId === MENU_WITH_HEADER },
      { frameId: info.frameId ?? 0 }
    )
    .catch(() => {
      // Content script not present (tab was open before install, or a restricted page like chrome://).
    });
});

// Toolbar button opens the settings.
chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());

// Fallback clipboard path: if the page blocks clipboard access (e.g. a cross-origin iframe
// without clipboard-write permission), the content script hands the text to us and we copy
// it from an offscreen document.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== "columngrab:clipboard-fallback") return;
  copyViaOffscreen(msg.text)
    .then(() => sendResponse({ ok: true }))
    .catch((err) => sendResponse({ ok: false, error: String(err) }));
  return true; // async response
});

async function copyViaOffscreen(text) {
  const url = chrome.runtime.getURL("offscreen.html");
  const existing = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
    documentUrls: [url],
  });
  if (existing.length === 0) {
    await chrome.offscreen.createDocument({
      url: "offscreen.html",
      reasons: ["CLIPBOARD"],
      justification: "Write the copied table column to the clipboard.",
    });
  }
  const res = await chrome.runtime.sendMessage({ type: "columngrab:offscreen-copy", text });
  if (!res?.ok) throw new Error(res?.error || "Offscreen copy failed");
}
