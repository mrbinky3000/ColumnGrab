// Offscreen document: performs clipboard writes on behalf of the service worker.
import { requireElement } from "./dom";
import { isOffscreenCopyMessage, type CopyResult } from "./messages";

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse: (r: CopyResult) => void) => {
  if (!isOffscreenCopyMessage(msg)) return;
  const ta = requireElement(document, "#buffer", HTMLTextAreaElement);

  ta.value = msg.text;
  ta.select();
  const ok = document.execCommand("copy");

  ta.value = "";
  sendResponse(ok ? { ok } : { ok, error: "execCommand('copy') returned false" });
});
