import { describe, it, expect } from "vitest";
import { validateSnapshot, SNAPSHOT_FORMAT } from "./snapshot-format";

const meta = { format: SNAPSHOT_FORMAT, takenAt: "2026-08-11T00:00:00.000Z" };
const good = { meta, data: { bills: [{ id: 1 }, { id: 2 }], staff: [] } };

describe("validateSnapshot", () => {
  it("accepts a real snapshot and hands back its tables", () => {
    const { data, meta: m } = validateSnapshot(good);
    expect(Object.keys(data)).toEqual(["bills", "staff"]);
    expect(data["bills"]).toHaveLength(2);
    expect(m.takenAt).toBe("2026-08-11T00:00:00.000Z");
  });

  it("accepts a table that is legitimately empty", () => {
    expect(() => validateSnapshot({ meta, data: { bills: [] } })).not.toThrow();
  });

  /* The dangerous case: a table that LOOKS present but carries no rows. The
     restore would truncate the live table and commit having put nothing back. */
  it("refuses a table whose rows are an object rather than a list", () => {
    expect(() => validateSnapshot({ meta, data: { bills: {} } })).toThrow(/not a list of rows/);
  });

  it("refuses a table whose rows are null, a scalar or a string", () => {
    for (const rows of [null, 0, 1, "rows", true]) {
      expect(() => validateSnapshot({ meta, data: { bills: rows } })).toThrow(/not a list of rows/);
    }
  });

  it("names the offending table so an admin knows what was wrong", () => {
    expect(() => validateSnapshot({ meta, data: { bills: [{ id: 1 }], sale_items: {} } }))
      .toThrow(/"sale_items"/);
  });

  it("refuses rows that are not records", () => {
    expect(() => validateSnapshot({ meta, data: { bills: [{ id: 1 }, 42] } })).toThrow(/row 2 .*"bills"/);
    expect(() => validateSnapshot({ meta, data: { bills: [null] } })).toThrow(/row 1/);
    expect(() => validateSnapshot({ meta, data: { bills: [[]] } })).toThrow(/row 1/);
  });

  it("refuses a file that is not a snapshot at all", () => {
    expect(() => validateSnapshot(null)).toThrow(/Unrecognised backup format/);
    expect(() => validateSnapshot([])).toThrow(/Unrecognised backup format/);
    expect(() => validateSnapshot("hello")).toThrow(/Unrecognised backup format/);
    expect(() => validateSnapshot({ data: { bills: [] } })).toThrow(/Unrecognised backup format/);
    expect(() => validateSnapshot({ meta: { format: "other-v9" }, data: {} })).toThrow(/Unrecognised backup format/);
  });

  it("refuses a snapshot with no data section or no tables", () => {
    expect(() => validateSnapshot({ meta })).toThrow(/no table data/);
    expect(() => validateSnapshot({ meta, data: null })).toThrow(/no table data/);
    expect(() => validateSnapshot({ meta, data: [] })).toThrow(/no table data/);
    expect(() => validateSnapshot({ meta, data: {} })).toThrow(/no table data/);
  });
});
