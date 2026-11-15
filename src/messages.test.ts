import { describe, expect, it } from "vitest";
import {
  isClipboardFallbackMessage,
  isCopyColumnMessage,
  isCopyResult,
  isOffscreenCopyMessage,
} from "./messages";

// Values a receiver could get that are not any of our messages.
const NOT_MESSAGES = [null, undefined, "columngrab:copy-column", 42, [], {}, { type: 1 }];

describe("isCopyColumnMessage", () => {
  it("accepts a well-formed message", () => {
    expect(isCopyColumnMessage({ type: "columngrab:copy-column", includeHeader: true })).toBe(true);
  });

  it("rejects a missing or non-boolean includeHeader", () => {
    expect(isCopyColumnMessage({ type: "columngrab:copy-column" })).toBe(false);
    expect(isCopyColumnMessage({ type: "columngrab:copy-column", includeHeader: "yes" })).toBe(false);
  });

  it("rejects another message type", () => {
    expect(isCopyColumnMessage({ type: "columngrab:offscreen-copy", includeHeader: true })).toBe(false);
  });

  it.each(NOT_MESSAGES)("rejects %j", (value) => {
    expect(isCopyColumnMessage(value)).toBe(false);
  });
});

describe.each([
  ["isClipboardFallbackMessage", isClipboardFallbackMessage, "columngrab:clipboard-fallback"],
  ["isOffscreenCopyMessage", isOffscreenCopyMessage, "columngrab:offscreen-copy"],
] as const)("%s", (_name, guard, type) => {
  it("accepts a well-formed message", () => {
    expect(guard({ type, text: "a\nb" })).toBe(true);
  });

  it("rejects a missing or non-string text", () => {
    expect(guard({ type })).toBe(false);
    expect(guard({ type, text: 5 })).toBe(false);
  });

  it("rejects another message type", () => {
    expect(guard({ type: "columngrab:copy-column", text: "a" })).toBe(false);
  });

  it.each(NOT_MESSAGES)("rejects %j", (value) => {
    expect(guard(value)).toBe(false);
  });
});

describe("isCopyResult", () => {
  it("accepts success and failure results", () => {
    expect(isCopyResult({ ok: true })).toBe(true);
    expect(isCopyResult({ ok: false, error: "denied" })).toBe(true);
    expect(isCopyResult({ ok: false, error: undefined })).toBe(true);
  });

  it("rejects a missing ok or a non-string error", () => {
    expect(isCopyResult({})).toBe(false);
    expect(isCopyResult({ ok: "true" })).toBe(false);
    expect(isCopyResult({ ok: false, error: 404 })).toBe(false);
  });

  it.each([null, undefined, true, "ok"])("rejects %j", (value) => {
    expect(isCopyResult(value)).toBe(false);
  });
});
