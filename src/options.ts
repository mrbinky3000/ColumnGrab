import { loadSettings, saveSettings, type Modifier } from "./settings";

const saved = document.getElementById("saved") as HTMLElement;
const trimEmpty = document.getElementById("trimEmpty") as HTMLInputElement;
const modifierRadios = document.querySelectorAll<HTMLInputElement>('input[name="modifier"]');
let savedTimer: ReturnType<typeof setTimeout> | undefined;

function flashSaved(): void {
  saved.textContent = "Saved";
  clearTimeout(savedTimer);
  savedTimer = setTimeout(() => (saved.textContent = ""), 1200);
}

void loadSettings().then((s) => {
  for (const radio of modifierRadios) radio.checked = radio.value === s.modifier;
  trimEmpty.checked = s.trimEmpty;
});

for (const radio of modifierRadios) {
  radio.addEventListener("change", () => {
    void saveSettings({ modifier: radio.value as Modifier }).then(flashSaved);
  });
}

trimEmpty.addEventListener("change", () => {
  void saveSettings({ trimEmpty: trimEmpty.checked }).then(flashSaved);
});
