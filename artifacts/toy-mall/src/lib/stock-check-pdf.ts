/**
 * Builds the supplier-wise stock-count sheet as a real PDF file (A4 portrait),
 * so it can be downloaded or handed to the Web Share API (WhatsApp etc.).
 *
 * jspdf + jspdf-autotable are loaded on demand — they are only needed on the
 * Stock Check page. Once loaded they are kept in `loadedLibs` so a click can
 * build the file *synchronously*: the OS share sheet only opens while the
 * click's user activation is still alive, so the Share handler must reach
 * `navigator.share` without waiting on the network.
 */
import type { jsPDF } from "jspdf";
import type { CellHookData, Styles, UserOptions, __createTable, __drawTable } from "jspdf-autotable";

/**
 * One sheet row. The lifetime figures come from `/api/stock-logs/product-totals`
 * and are reduced on the page (see StockCheck's `toSheetItem`) so that
 * `inTotal - outNet - adj === stock` holds for every row.
 */
export interface StockSheetItem {
  id: string;
  name: string;
  sku: string;
  category: string;
  /** All units ever received: stock entries plus opening stock set at creation. */
  inTotal: number;
  /** Number of stock-ins; opening stock counts as one. */
  entries: number;
  /** Units sold minus units customers returned. */
  outNet: number;
  /** Units customers returned (already netted out of `outNet`; shown as a note). */
  returned: number;
  /** Units removed without a sale (corrections / edits); shown as a note under Stock. */
  adj: number;
  stock: number;
}

export interface StockSheetGroup {
  key: string;
  name: string;
  phone?: string | null;
  items: StockSheetItem[];
  units: number;
  inTotal: number;
  outNet: number;
}

export interface StockSheetInput {
  storeName: string;
  groups: StockSheetGroup[];
  /** Start every supplier after the first on a fresh page. */
  pagePerSupplier: boolean;
  /** Already-formatted IST timestamp shown in the header/footer. */
  printedAt: string;
  totalItems: number;
  totalUnits: number;
  totalIn: number;
  totalOut: number;
}

/** How the figure columns are defined — printed under the sheet header so the reader needs no app. */
export const SHEET_LEGEND =
  "In = stock entries + opening stock (stock not covered by any entry) · Entries = number of stock-ins, opening counts as one · Out = sold minus returns · Stock = in system now";
/** Appended to the legend only when some row carries an adjustment note. */
export const SHEET_LEGEND_ADJ = " · adj = removed without a sale (correction)";

/** Footer/summary wording shared by the screen, print and PDF views. */
export const sheetTotalsLine = (items: number, inTotal: number, outNet: number, units: number): string =>
  `${items} item${items !== 1 ? "s" : ""} · ${inTotal} in · ${outNet} out · ${units} pc in system`;

export type PdfLibs = {
  jsPDF: typeof jsPDF;
  createTable: typeof __createTable;
  drawTable: typeof __drawTable;
};

let loadedLibs: PdfLibs | null = null;
let libsPromise: Promise<PdfLibs> | null = null;

/** The libraries, if the dynamic import has already finished — lets callers skip every `await`. */
export const getLoadedPdfLibs = (): PdfLibs | null => loadedLibs;

/** Kick off the (cached) dynamic import so the click handler doesn't wait on the network. */
export function preloadStockSheetPdf(): Promise<PdfLibs> {
  if (!libsPromise) {
    libsPromise = Promise.all([import("jspdf"), import("jspdf-autotable")])
      .then(([j, a]) => {
        loadedLibs = { jsPDF: j.jsPDF, createTable: a.__createTable, drawTable: a.__drawTable };
        return loadedLibs;
      })
      .catch((err: unknown) => {
        libsPromise = null; // let a later click retry the download of the chunk
        throw err;
      });
  }
  return libsPromise;
}

/* ── Text helpers ────────────────────────────────────────────────── */

/**
 * jsPDF's built-in fonts only cover WinAnsi (cp1252). Anything outside it —
 * e.g. Devanagari — would come out as garbage glyphs, so swap it for "?"
 * rather than silently corrupting the sheet.
 */
const WIN_ANSI_EXTRA = "\u20AC\u201A\u0192\u201E\u2026\u2020\u2021\u02C6\u2030\u0160\u2039\u0152\u017D\u2018\u2019\u201C\u201D\u2022\u2013\u2014\u02DC\u2122\u0161\u203A\u0153\u017E\u0178";
const UNSUPPORTED = new RegExp(`[^\\x20-\\x7E\\xA0-\\xFF${WIN_ANSI_EXTRA}]`, "g");
export const pdfText = (value: string | null | undefined): string =>
  (value ?? "").replace(/\s+/g, " ").trim().replace(UNSUPPORTED, "?");

/** Truncate with an ellipsis so a long store name can't run off the page. */
function fitText(doc: jsPDF, text: string, maxWidth: number): string {
  if (doc.getTextWidth(text) <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && doc.getTextWidth(`${out}…`) > maxWidth) out = out.slice(0, -1);
  return `${out.trimEnd()}…`;
}

export function stockSheetFilename(storeName: string, now = new Date()): string {
  const slug = storeName
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  // IST calendar day, independent of the device timezone.
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
  return `stock-check-${slug || "sheet"}-${day}.pdf`;
}

/* ── Layout constants (mm, A4 portrait) ─────────────────────────── */
const MARGIN_X = 12;
const MARGIN_TOP = 12;
const MARGIN_BOTTOM = 14;
const COUNT_BOX = { w: 13, h: 4.8 };
const GROUP_GAP = 5;
const COLUMNS = 9;
/* Column indexes — the body row array and didDrawCell must agree on these. */
const COL = { index: 0, item: 1, category: 2, in: 3, entries: 4, out: 5, stock: 6, counted: 7, note: 8 } as const;
/* Sum of the widths below must stay 186 (A4 width minus the two margins). */
const COL_WIDTHS: Record<number, number> = {
  [COL.index]: 7, [COL.item]: 52, [COL.category]: 25, [COL.in]: 14, [COL.entries]: 14,
  [COL.out]: 14, [COL.stock]: 14, [COL.counted]: 18, [COL.note]: 28,
};

/* ── Builder ─────────────────────────────────────────────────────── */

/** Async convenience wrapper: loads the libraries if needed, then builds. */
export async function buildStockSheetPdf(input: StockSheetInput): Promise<Blob> {
  const libs = loadedLibs ?? (await preloadStockSheetPdf());
  return buildStockSheetPdfSync(libs, input);
}

/** Pure, synchronous build — safe to call inside a click handler once the libs are loaded. */
export function buildStockSheetPdfSync({ jsPDF, createTable, drawTable }: PdfLibs, input: StockSheetInput): Blob {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - MARGIN_X * 2;
  const bottomLimit = pageH - MARGIN_BOTTOM;
  const storeName = pdfText(input.storeName) || "Stock check";
  const printedAt = pdfText(input.printedAt);

  doc.setFont("helvetica", "normal");

  /* Sheet header (first page only, like the printed sheet). */
  let y = MARGIN_TOP;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0);
  doc.text(fitText(doc, storeName, contentW - 48), MARGIN_X, y + 4.5);
  doc.setFontSize(9.5);
  doc.text("STOCK CHECK SHEET", pageW - MARGIN_X, y + 4.5, { align: "right", charSpace: 0.4 });
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(70);
  doc.text(`Printed: ${printedAt}`, MARGIN_X, y + 2.5);
  doc.text("Checked by: ____________________     Date: ____________", pageW - MARGIN_X, y + 2.5, { align: "right" });
  y += 5;
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.line(MARGIN_X, y, pageW - MARGIN_X, y);
  y += 3;
  /* Column legend: the sheet travels on paper / WhatsApp, so it explains its own figures. */
  const hasAdj = input.groups.some((g) => g.items.some((p) => p.adj > 0));
  doc.setFontSize(7);
  doc.setTextColor(90);
  const legendLines: string[] = doc.splitTextToSize(pdfText(SHEET_LEGEND + (hasAdj ? SHEET_LEGEND_ADJ : "")), contentW);
  doc.text(legendLines, MARGIN_X, y + 2);
  y += 2 + legendLines.length * 3;

  /* Figures sit at the top of their cell so they line up with the item name,
     leaving the bottom band free for the small notes drawn in didDrawCell. */
  const figure: Partial<Styles> = {
    halign: "right", valign: "top", fontStyle: "bold",
    cellPadding: { top: 1.2, bottom: 3.9, left: 1.5, right: 1.5 },
  };

  input.groups.forEach((group, gi) => {
    if (gi > 0 && input.pagePerSupplier) {
      doc.addPage();
      y = MARGIN_TOP;
    }

    const count = group.items.length;
    const meta = `${count} item${count !== 1 ? "s" : ""} · ${group.inTotal} in · ${group.outNet} out · ${group.units} pc`;
    const title = `${gi + 1}. ${pdfText(group.name)}`;
    const phoneSuffix = group.phone ? `  ·  ${pdfText(group.phone)}` : "";
    const skus = group.items.map((p) => pdfText(p.sku));
    /* Small notes under a figure: "2 ret" under Out, "-3 adj" under Stock. ASCII
       hyphen on purpose — U+2212 is outside WinAnsi and would print as "?". */
    const outNotes = group.items.map((p) => (p.returned > 0 ? `${p.returned} ret` : ""));
    const stockNotes = group.items.map((p) => (p.adj > 0 ? `-${p.adj} adj` : ""));

    /* The supplier title is the first head row, so it repeats on continuation
       pages and can never be separated from its column header. The meta text
       is drawn into the same spanned cell, right-aligned. */
    const options: UserOptions = {
      startY: y,
      margin: { left: MARGIN_X, right: MARGIN_X, top: MARGIN_TOP, bottom: MARGIN_BOTTOM },
      theme: "grid",
      tableWidth: contentW,
      rowPageBreak: "avoid",
      styles: {
        font: "helvetica", fontSize: 8.2, textColor: 0, lineColor: 190, lineWidth: 0.2,
        cellPadding: { top: 1.2, bottom: 1.2, left: 1.5, right: 1.5 }, valign: "middle", overflow: "linebreak",
      },
      headStyles: {
        fillColor: 235, textColor: 20, fontStyle: "bold", fontSize: 7, lineColor: 120, lineWidth: 0.3,
      },
      columnStyles: {
        [COL.index]: { cellWidth: COL_WIDTHS[COL.index], textColor: 90, halign: "center" },
        [COL.item]: { cellWidth: COL_WIDTHS[COL.item], fontStyle: "bold", cellPadding: { top: 1.2, bottom: 3.9, left: 1.5, right: 1.5 } },
        [COL.category]: { cellWidth: COL_WIDTHS[COL.category], textColor: 90 },
        [COL.in]: { ...figure, cellWidth: COL_WIDTHS[COL.in], textColor: 60 },
        [COL.entries]: { ...figure, cellWidth: COL_WIDTHS[COL.entries], fontStyle: "normal", textColor: 90 },
        [COL.out]: { ...figure, cellWidth: COL_WIDTHS[COL.out], textColor: 60 },
        [COL.stock]: { ...figure, cellWidth: COL_WIDTHS[COL.stock] },
        [COL.counted]: { cellWidth: COL_WIDTHS[COL.counted], minCellHeight: COUNT_BOX.h + 2.4 },
        [COL.note]: { cellWidth: COL_WIDTHS[COL.note] },
      },
      head: [
        [{
          content: "", // drawn by hand below so the title can be ellipsised and the meta right-aligned
          colSpan: COLUMNS,
          styles: {
            fillColor: 255, lineWidth: 0, minCellHeight: 7.5,
            cellPadding: { top: 1.5, bottom: 1.5, left: 0, right: 0 },
          },
        }],
        [
          "#", "ITEM", "CATEGORY",
          { content: "IN", styles: { halign: "right" } },
          { content: "ENTRIES", styles: { halign: "right" } },
          { content: "OUT", styles: { halign: "right" } },
          { content: "STOCK", styles: { halign: "right" } },
          "COUNTED", "NOTE",
        ],
      ],
      body: group.items.map((p, i) => [
        String(i + 1), pdfText(p.name), pdfText(p.category) || "—",
        String(p.inTotal), String(p.entries), String(p.outNet), String(p.stock), "", "",
      ]),
      didDrawCell: (data: CellHookData) => {
        const { cell } = data;
        if (data.section === "head") {
          if (data.row.index !== 0) return;
          const baseline = cell.y + cell.height - 2.4;
          doc.setFont("helvetica", "bold");
          doc.setTextColor(0);
          doc.setFontSize(8);
          const metaW = doc.getTextWidth(meta);
          doc.text(meta, cell.x + cell.width, baseline, { align: "right" });
          doc.setFontSize(10.5);
          // Ellipsise the name, never the phone number.
          const avail = cell.width - metaW - 4;
          const phoneW = phoneSuffix ? doc.getTextWidth(phoneSuffix) : 0;
          doc.text(fitText(doc, title, Math.max(20, avail - phoneW)) + phoneSuffix, cell.x, baseline);
          return;
        }
        if (data.section !== "body") return;
        if (data.column.index === COL.item) {
          const sku = skus[data.row.index];
          if (sku) {
            doc.setFont("courier", "normal");
            doc.setFontSize(6.3);
            doc.setTextColor(110);
            doc.text(fitText(doc, sku, cell.width - 3), cell.x + 1.5, cell.y + cell.height - 1.5);
          }
        } else if (data.column.index === COL.out || data.column.index === COL.stock) {
          const note = (data.column.index === COL.out ? outNotes : stockNotes)[data.row.index];
          if (note) {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(6.3);
            doc.setTextColor(110);
            doc.text(note, cell.x + cell.width - 1.5, cell.y + cell.height - 1.5, { align: "right" });
          }
        } else if (data.column.index === COL.counted) {
          doc.setDrawColor(140);
          doc.setLineWidth(0.25);
          doc.roundedRect(
            cell.x + (cell.width - COUNT_BOX.w) / 2,
            cell.y + (cell.height - COUNT_BOX.h) / 2,
            COUNT_BOX.w, COUNT_BOX.h, 0.8, 0.8, "S",
          );
        }
      },
    };

    /* Keep the head together with the first product row: autotable only
       guarantees room for the head itself, so measure the laid-out table and
       start on a fresh page when the first row wouldn't fit beneath it. */
    const table = createTable(doc, options);
    const firstRowH = table.body[0]?.height ?? 0;
    if (y + table.getHeadHeight(table.columns) + firstRowH > bottomLimit) {
      doc.addPage();
      table.settings.startY = MARGIN_TOP;
    }
    drawTable(doc, table);
    y = (table.finalY ?? table.settings.startY) + GROUP_GAP;
  });

  /* Closing totals line */
  if (y + 8 > bottomLimit) {
    doc.addPage();
    y = MARGIN_TOP;
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(90);
  doc.text(
    fitText(doc, `${sheetTotalsLine(input.totalItems, input.totalIn, input.totalOut, input.totalUnits)} · Generated by ${storeName}`, contentW),
    pageW / 2, y + 2, { align: "center" },
  );

  /* Running footer with page numbers on every page */
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(120);
    doc.text(fitText(doc, `${storeName} · Stock check · ${printedAt}`, contentW - 30), MARGIN_X, pageH - 6);
    doc.text(`Page ${p} of ${pages}`, pageW - MARGIN_X, pageH - 6, { align: "right" });
  }

  return doc.output("blob");
}

/* ── Delivery helpers ────────────────────────────────────────────── */

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the browser a moment to start the download before releasing the URL.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export type ShareOutcome = "shared" | "cancelled" | "unsupported" | "blocked" | "failed";

/**
 * Hands the PDF to the OS share sheet. `navigator.share` is invoked
 * synchronously (before the first `await`) so a still-valid user activation
 * is spent on it rather than on anything else.
 */
export async function sharePdf(file: File, title: string): Promise<ShareOutcome> {
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (typeof nav.share !== "function" || typeof nav.canShare !== "function") return "unsupported";
  if (!nav.canShare({ files: [file] })) return "unsupported";
  try {
    await nav.share({ files: [file], title });
    return "shared";
  } catch (err: unknown) {
    if (err instanceof DOMException) {
      if (err.name === "AbortError") return "cancelled"; // user closed the sheet
      if (err.name === "NotAllowedError") return "blocked"; // activation expired / permission denied
    }
    return "failed";
  }
}
