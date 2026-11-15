import { requireElement } from "./dom";
import { isModifier, loadSettings, saveSettings } from "./settings";

const saved = requireElement(document, "#saved", HTMLElement);
const trimEmpty = requireElement(document, "#trimEmpty", HTMLInputElement);
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
    const modifier = radio.value;

    if (isModifier(modifier)) void saveSettings({ modifier }).then(flashSaved);
  });
}

trimEmpty.addEventListener("change", () => {
  void saveSettings({ trimEmpty: trimEmpty.checked }).then(flashSaved);
});
