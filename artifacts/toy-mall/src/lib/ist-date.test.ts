import { test } from "node:test";
import assert from "node:assert/strict";
import { isWithinIstDateRange } from "./ist-date";

test("custom billing range includes both IST day boundaries", () => {
  const inDay = (value: string) => isWithinIstDateRange(value, "2026-10-24", "2026-10-24");
  assert.equal(inDay("2026-10-23T18:29:59.999Z"), false);
  assert.equal(inDay("2026-10-23T18:30:00.000Z"), true);
  assert.equal(inDay("2026-10-24T18:29:59.999Z"), true);
  assert.equal(inDay("2026-10-24T18:30:00.000Z"), false);
});

test("custom billing range handles supplier date-only values and invalid selections", () => {
  assert.equal(isWithinIstDateRange("2026-10-01", "2026-10-01", "2026-10-24"), true);
  assert.equal(isWithinIstDateRange("2026-10-24", "2026-10-01", "2026-10-24"), true);
  assert.equal(isWithinIstDateRange("2026-10-25", "2026-10-01", "2026-10-24"), false);
  assert.equal(isWithinIstDateRange("invalid", "2026-10-01", "2026-10-24"), false);
  assert.equal(isWithinIstDateRange("2026-10-24", "", ""), false);
  assert.equal(isWithinIstDateRange("2026-10-24", "2026-10-25", "2026-10-24"), false);
});
