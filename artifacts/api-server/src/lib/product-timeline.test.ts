import { describe, expect, it } from "vitest";
import { saleLineMoney, shapeTimelineEvent, staffLabel, type TimelineRow } from "./product-timeline";

const base: TimelineRow = {
  id: "log-1",
  type: "OUT",
  quantity: 1,
  userId: "staff-1",
  staffName: "Prabhat",
  purchasePrice: null,
  supplierName: null,
  invoiceNumber: null,
  note: null,
  createdAt: new Date("2026-09-02T08:41:34.539Z"),
  billId: null,
  billNumber: null,
  customerName: null,
  customerPhone: null,
  paymentMode: null,
  lineCount: null,
  minPrice: null,
  maxPrice: null,
  linesTotal: null,
  refundAmount: null,
  returnReason: null,
};

const owner = (row: TimelineRow) => shapeTimelineEvent(row, "owner");
const manager = (row: TimelineRow) => shapeTimelineEvent(row, "manager");

const billed: TimelineRow = {
  ...base,
  billId: "bill-1", billNumber: 1246, customerName: "Ramesh", customerPhone: "9876543210",
  paymentMode: "upi", lineCount: 1, minPrice: "950.00", maxPrice: "950.00", linesTotal: "950.00",
};

describe("staffLabel", () => {
  it("prefers the resolved staff name", () => {
    expect(staffLabel("abc", "Asha")).toBe("Asha");
  });

  it("labels API-key writes by key name and never as a person", () => {
    expect(staffLabel("apikey:Sync bot", null)).toBe("API key · Sync bot");
    expect(staffLabel("apikey-absolute:ERP", null)).toBe("API key · ERP");
    expect(staffLabel("apikey:", null)).toBe("API key");
  });

  it("is unknown for legacy rows with no author", () => {
    expect(staffLabel(null, null)).toBeNull();
    expect(staffLabel("00000000-dead-beef-0000-000000000000", null)).toBeNull();
  });
});

describe("saleLineMoney", () => {
  it("uses the line's own figures when the product sits on one line", () => {
    expect(saleLineMoney({ quantity: 2, lineCount: 1, minPrice: "120", maxPrice: "120", linesTotal: "240" }))
      .toEqual({ unitPrice: 120, lineTotal: 240 });
  });

  it("derives quantity × price when several lines share one price", () => {
    /* two lines of 1 pc each at ₹950: each OUT event is worth its own units, not the ₹1900 aggregate */
    expect(saleLineMoney({ quantity: 1, lineCount: 2, minPrice: "950", maxPrice: "950", linesTotal: "1900" }))
      .toEqual({ unitPrice: 950, lineTotal: 950 });
  });

  it("shows no figure when the lines disagree on price", () => {
    expect(saleLineMoney({ quantity: 1, lineCount: 2, minPrice: "900", maxPrice: "950", linesTotal: "1850" }))
      .toEqual({ unitPrice: null, lineTotal: null });
  });

  it("is empty for a counter sale with no bill lines", () => {
    expect(saleLineMoney({ quantity: 1, lineCount: null, minPrice: null, maxPrice: null, linesTotal: null }))
      .toEqual({ unitPrice: null, lineTotal: null });
  });
});

describe("shapeTimelineEvent", () => {
  it("attaches the bill and customer to a billed sale with numeric money", () => {
    const e = owner(billed);
    expect(e.type).toBe("OUT");
    expect(e.at).toBe("2026-09-02T08:41:34.539Z");
    expect(e.by).toBe("Prabhat");
    expect(e.bill).toEqual({
      id: "bill-1", number: 1246, customerName: "Ramesh", customerPhone: "9876543210",
      paymentMode: "upi", unitPrice: 950, lineTotal: 950,
    });
    expect(e.refundAmount).toBeNull();
  });

  it("leaves a counter sale without a bill", () => {
    const e = owner(base);
    expect(e.bill).toBeNull();
    expect(e.setsLevel).toBe(false);
  });

  it("keeps supplier, invoice and cost on stock-ins only", () => {
    const inRow: TimelineRow = {
      ...base, type: "IN", quantity: 3, supplierName: "Eureka", invoiceNumber: "INV-9", purchasePrice: "150.50",
    };
    const e = owner(inRow);
    expect(e.supplierName).toBe("Eureka");
    expect(e.invoiceNumber).toBe("INV-9");
    expect(e.purchasePrice).toBe(150.5);

    /* the same columns are never echoed on a sale row, even if a legacy log carried them */
    const out = owner({ ...inRow, type: "OUT" });
    expect(out.supplierName).toBeNull();
    expect(out.purchasePrice).toBeNull();
  });

  it("omits cost and customer phone from the manager view — absent, not null", () => {
    const inRow: TimelineRow = { ...base, type: "IN", quantity: 3, purchasePrice: "150.50" };
    expect("purchasePrice" in manager(inRow)).toBe(false);
    expect(manager(inRow).purchasePrice).toBeUndefined();

    const sale = manager(billed);
    expect(sale.bill).not.toBeNull();
    expect("customerPhone" in (sale.bill ?? {})).toBe(false);
    /* the operational facts stay: bill, customer name, payment, what it sold for */
    expect(sale.bill?.number).toBe(1246);
    expect(sale.bill?.customerName).toBe("Ramesh");
    expect(sale.bill?.unitPrice).toBe(950);
  });

  it("carries refund and reason on a return, with the original bill", () => {
    const e = owner({
      ...base, type: "RETURN", billId: "bill-2", billNumber: 853, customerPhone: "8789528070",
      paymentMode: "cash", refundAmount: "850", returnReason: "Customer return",
      lineCount: 1, minPrice: "950", maxPrice: "950", linesTotal: "950",
    });
    expect(e.refundAmount).toBe(850);
    expect(e.returnReason).toBe("Customer return");
    expect(e.bill?.number).toBe(853);
    /* sale-line money belongs to the sale, not the return */
    expect(e.bill?.unitPrice).toBeNull();
    expect(e.bill?.lineTotal).toBeNull();
  });

  it("marks in-app corrections as absolute levels and legacy API deltas as changes", () => {
    const absolute = owner({ ...base, type: "ADJUSTMENT", quantity: 5, userId: "staff-1" });
    expect(absolute.setsLevel).toBe(true);

    const legacyDelta = owner({
      ...base, type: "ADJUSTMENT", quantity: -2, userId: "apikey:ERP", staffName: null,
    });
    expect(legacyDelta.setsLevel).toBe(false);
    expect(legacyDelta.by).toBe("API key · ERP");

    const absoluteViaApi = owner({
      ...base, type: "ADJUSTMENT", quantity: 7, userId: "apikey-absolute:ERP", staffName: null,
    });
    expect(absoluteViaApi.setsLevel).toBe(true);
  });
});
