import { describe, expect, it } from "vitest";
import { balances, date, entryInput, noteInput, paise, todayIST, uuid } from "./daily-book";

describe("Daily Book boundary rules", () => {
  it("uses exact paise, not floating point", () => {
    expect(paise("1000")).toBe("100000");
    expect(paise("0.01")).toBe("1");
    expect(paise("0.29")).toBe("29");
    expect(paise("10000000.00")).toBe("1000000000");
  });
  it.each(["0", "-1", "1.001", "NaN", "1e3", "10000000.01", "01", "", 1])("rejects invalid amount %s", value => {
    expect(() => paise(value)).toThrow();
  });
  it("does not net balances between different people and does not lose precision", () => {
    expect(balances(["70000","-50000","0"])).toEqual({ receivablePaise:"70000",payablePaise:"50000" });
    expect(balances(["9007199254740993","2","-9007199254740999"])).toEqual({
      receivablePaise:"9007199254740995",payablePaise:"9007199254740999",
    });
  });
  it("changes the IST day at midnight IST rather than UTC", () => {
    expect(todayIST(new Date("2026-10-10T18:29:59Z"))).toBe("2026-10-10");
    expect(todayIST(new Date("2026-10-10T18:30:00Z"))).toBe("2026-10-11");
  });
  it.each(["2026-02-29","2026-02-30","2026-13-01","01/10/2026","1999-12-31"])("rejects invalid date %s", value => {
    expect(() => date(value)).toThrow();
  });
  it("validates due dates and clears due dates when converting a task to a note", () => {
    expect(noteInput({ content:"  Call supplier  ",entryDate:"2026-10-10",isTask:false,dueDate:"2026-10-12" })).toEqual({
      content:"Call supplier",entryDate:"2026-10-10",isTask:false,dueDate:null,
    });
    expect(() => noteInput({ content:" ",entryDate:"2026-10-10",isTask:true })).toThrow();
  });
  it("does not accept future money, unknown methods, directions or object notes", () => {
    const input = { direction:"given",amount:"100",entryDate:"2026-01-01",method:"upi",note:"test" };
    expect(entryInput(input).amountPaise).toBe("10000");
    for (const change of [{ entryDate:"2100-01-01" }, { method:"card" }, { direction:"expense" }, { note:{} }])
      expect(() => entryInput({ ...input,...change })).toThrow();
  });
  it("rejects arbitrary paths as IDs", () => {
    expect(() => uuid("not-an-id")).toThrow();
    expect(uuid("d3aa5b4a-790c-45a7-87b3-b0c9e6275051")).toBe("d3aa5b4a-790c-45a7-87b3-b0c9e6275051");
  });
});
