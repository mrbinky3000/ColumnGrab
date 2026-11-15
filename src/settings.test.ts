import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from "./settings";

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
});

describe("saveSettings", () => {
  it("writes only the changed keys", async () => {
    await saveSettings({ modifier: "alt+shift" });
    expect(set).toHaveBeenCalledWith({ modifier: "alt+shift" });
  });
});
