import { describe, expect, it } from "vitest";
import { allowsWriteOrigin } from "./request-origin";

describe("browser write origin policy", () => {
  const self = "https://shop.example";
  it("allows same-origin and explicit trusted frontends", () => {
    expect(allowsWriteOrigin(self, self, [])).toBe(true);
    expect(allowsWriteOrigin("https://pos.example", self, ["https://pos.example"])).toBe(true);
  });
  it("blocks arbitrary, opaque, malformed and lookalike origins", () => {
    for (const origin of ["https://evil.example", "null", "not-a-url", "https://shop.example.evil.test", `${self}/path`]) {
      expect(allowsWriteOrigin(origin, self, [])).toBe(false);
    }
  });
  it("supports non-browser clients without an Origin header", () => {
    expect(allowsWriteOrigin(undefined, self, [])).toBe(true);
  });
});
