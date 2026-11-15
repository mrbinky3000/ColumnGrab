// Offscreen document: performs clipboard writes on behalf of the service worker.
import { requireElement } from "./dom";
import { isFromExtension, isOffscreenCopyMessage, type CopyResult } from "./messages";

// Content scripts' runtime messages reach this document too, so accept copy requests only
// from the extension itself (the service worker), never from a tab.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse: (r: CopyResult) => void) => {
  if (!isOffscreenCopyMessage(msg) || !isFromExtension(sender, chrome.runtime.id)) return;
  const ta = requireElement(document, "#buffer", HTMLTextAreaElement);

  ta.value = msg.text;
  ta.select();
  const ok = document.execCommand("copy");

  ta.value = "";
  sendResponse(ok ? { ok } : { ok, error: "execCommand('copy') returned false" });
});
