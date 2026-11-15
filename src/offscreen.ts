// Offscreen document: performs clipboard writes on behalf of the service worker.
import { isMessage, type CopyResult, type OffscreenCopyMessage } from "./messages";

chrome.runtime.onMessage.addListener((msg: unknown, _sender, sendResponse: (r: CopyResult) => void) => {
  if (!isMessage<OffscreenCopyMessage>(msg, "columngrab:offscreen-copy")) return;
  const ta = document.getElementById("buffer") as HTMLTextAreaElement;
  ta.value = msg.text;
  ta.select();
  const ok = document.execCommand("copy");
  ta.value = "";
  sendResponse(ok ? { ok } : { ok, error: "execCommand('copy') returned false" });
});
