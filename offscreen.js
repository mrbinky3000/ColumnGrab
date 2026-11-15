chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== "columngrab:offscreen-copy") return;
  const ta = document.getElementById("buffer");
  ta.value = msg.text;
  ta.select();
  const ok = document.execCommand("copy");
  ta.value = "";
  sendResponse({ ok, error: ok ? undefined : "execCommand('copy') returned false" });
});
