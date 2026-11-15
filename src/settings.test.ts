import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, isModifier, loadSettings, saveSettings } from "./settings";

const get = vi.fn();
const set = vi.fn();

beforeEach(() => {
  get.mockReset();
  set.mockReset().mockResolvedValue(undefined);
  vi.stubGlobal("chrome", { storage: { sync: { get, set } } });
});

describe("loadSettings", () => {
  it("asks storage for every setting, with defaults as fallbacks", async () => {
    get.mockResolvedValue({ ...DEFAULT_SETTINGS });
    await loadSettings();
    expect(get).toHaveBeenCalledWith(DEFAULT_SETTINGS);
  });

  it("returns stored values over defaults", async () => {
    get.mockResolvedValue({ modifier: "ctrl+alt", trimEmpty: true });
    await expect(loadSettings()).resolves.toEqual({ modifier: "ctrl+alt", trimEmpty: true });
  });

  it("fills in defaults for keys storage didn't return", async () => {
    get.mockResolvedValue({ trimEmpty: true });
    await expect(loadSettings()).resolves.toEqual({ ...DEFAULT_SETTINGS, trimEmpty: true });
  });

  it.each(["constructor", "__proto__", "toString", "ctrl", "", 1, null])(
    "replaces an invalid modifier %j with the default",
    async (modifier) => {
      get.mockResolvedValue({ modifier, trimEmpty: true });
      await expect(loadSettings()).resolves.toEqual({ ...DEFAULT_SETTINGS, trimEmpty: true });
    },
  );

  it.each(["true", 1, null])("replaces a non-boolean trimEmpty %j with the default", async (trimEmpty) => {
    get.mockResolvedValue({ modifier: "alt+shift", trimEmpty });
    await expect(loadSettings()).resolves.toEqual({ ...DEFAULT_SETTINGS, modifier: "alt+shift" });
  });

  it("drops stored keys that aren't settings", async () => {
    get.mockResolvedValue({ ...DEFAULT_SETTINGS, extra: "x" });
    await expect(loadSettings()).resolves.toEqual(DEFAULT_SETTINGS);
  });
});

describe("isModifier", () => {
  it("accepts the presets and rejects anything else", () => {
    expect(isModifier("alt")).toBe(true);
    expect(isModifier("ctrl+alt")).toBe(true);
    expect(isModifier("constructor")).toBe(false);
    expect(isModifier(undefined)).toBe(false);
  });
});

describe("saveSettings", () => {
  it("writes only the changed keys", async () => {
    await saveSettings({ modifier: "alt+shift" });
    expect(set).toHaveBeenCalledWith({ modifier: "alt+shift" });
  });
});
