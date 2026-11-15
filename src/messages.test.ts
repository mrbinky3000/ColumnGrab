import { describe, expect, it } from "vitest";
import { isMessage, type CopyColumnMessage } from "./messages";

describe("isMessage", () => {
  it("accepts an object with the matching type tag", () => {
    const msg: unknown = { type: "columngrab:copy-column", includeHeader: true };
    expect(isMessage<CopyColumnMessage>(msg, "columngrab:copy-column")).toBe(true);
  });

  it("rejects a different type tag", () => {
    expect(isMessage<CopyColumnMessage>({ type: "columngrab:offscreen-copy" }, "columngrab:copy-column")).toBe(false);
  });

  it.each([null, undefined, "columngrab:copy-column", 42, {}, { type: 1 }])("rejects %j", (msg) => {
    expect(isMessage<CopyColumnMessage>(msg, "columngrab:copy-column")).toBe(false);
  });
});
