const DEFAULTS = { modifier: "alt", trimEmpty: false };
const saved = document.getElementById("saved");
let savedTimer = 0;

function flashSaved() {
  saved.textContent = "Saved";
  clearTimeout(savedTimer);
  savedTimer = setTimeout(() => (saved.textContent = ""), 1200);
}

chrome.storage.sync.get(DEFAULTS, (s) => {
  const radio = document.querySelector(`input[name="modifier"][value="${s.modifier}"]`);
  if (radio) radio.checked = true;
  document.getElementById("trimEmpty").checked = s.trimEmpty;
});

document.querySelectorAll('input[name="modifier"]').forEach((el) =>
  el.addEventListener("change", () => chrome.storage.sync.set({ modifier: el.value }, flashSaved))
);
document.getElementById("trimEmpty").addEventListener("change", (e) =>
  chrome.storage.sync.set({ trimEmpty: e.target.checked }, flashSaved)
);
