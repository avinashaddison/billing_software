import { getCategoryEmoji, getCategoryHex } from "@/lib/category-colors";
import { BarcodePngImage } from "@/components/ui/BarcodeImage";
import { useStoreSettings } from "@/lib/store-info";

export type LabelProduct = {
  id: string;
  name: string;
  sku: string;
  price: number;
  salePrice?: number | null;
  category: string;
  stock: number;
};

interface LabelCardProps {
  p: LabelProduct;
  compact?: boolean;
  printMode?: boolean;
}

export function LabelCard({ p, compact = false, printMode = false }: LabelCardProps) {
  const hex       = getCategoryHex(p.category);
  const emoji     = getCategoryEmoji(p.category);
  const store     = useStoreSettings();
  const showPrice = store.labelShowPrice ?? true;
  const hasSale   = showPrice && p.salePrice != null;
  const mrp       = Number(p.price).toLocaleString("en-IN");
  const sale      = hasSale ? Number(p.salePrice!).toLocaleString("en-IN") : null;

  /* ── Print mode: 50mm × 25mm compact thermal label ── */
  if (printMode) {
    return (
      <div style={{
        width: "100%", height: "100%",
        fontFamily: "Arial, 'Helvetica Neue', sans-serif",
        background: "#fff", color: "#000",
        display: "flex", flexDirection: "column",
        boxSizing: "border-box",
        overflow: "hidden",
      }}>

        {/* Store name — solid black banner */}
        <div style={{
          background: "#000", color: "#fff",
          textAlign: "center",
          fontSize: "6.5pt", fontWeight: 900,
          letterSpacing: "0.8pt", textTransform: "uppercase",
          padding: "0.6mm 1mm",
          flexShrink: 0,
          overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis",
          printColorAdjust: "exact",
          WebkitPrintColorAdjust: "exact",
        } as React.CSSProperties}>
          {store.name}
        </div>

        {/* Middle row: product info left + price right */}
        <div style={{
          display: "flex", flexDirection: "row",
          flex: 1, minHeight: 0,
          overflow: "hidden",
        }}>
          {/* Product name + SKU */}
          <div style={{
            flex: showPrice ? "0 0 58%" : 1,
            padding: "0.8mm 1.5mm 0.5mm",
            display: "flex", flexDirection: "column",
            justifyContent: "center",
            overflow: "hidden",
          }}>
            <div style={{
              fontSize: "7pt", fontWeight: 800, lineHeight: 1.2,
              overflow: "hidden", textOverflow: "ellipsis",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            } as React.CSSProperties}>
              {p.name}
            </div>
            <div style={{
              fontSize: "5.5pt", fontFamily: "monospace",
              color: "#555", marginTop: "0.4mm", lineHeight: 1,
            }}>
              {p.sku}
            </div>
          </div>

          {/* Price column */}
          {showPrice && (
            <div style={{
              flex: "0 0 42%",
              borderLeft: "0.3mm solid #ccc",
              padding: "0.8mm 1.5mm 0.5mm 1.2mm",
              display: "flex", flexDirection: "column",
              justifyContent: "center",
              overflow: "hidden",
            }}>
              {hasSale ? (
                <>
                  <div style={{
                    fontSize: "5pt", fontWeight: 700,
                    color: "#555", lineHeight: 1.1,
                    textDecoration: "line-through",
                    whiteSpace: "nowrap",
                  }}>
                    MRP ₹{mrp}
                  </div>
                  <div style={{
                    fontSize: "8.5pt", fontWeight: 900,
                    lineHeight: 1.1, whiteSpace: "nowrap",
                    overflow: "hidden", textOverflow: "ellipsis",
                  }}>
                    ₹{sale}
                  </div>
                  <div style={{
                    fontSize: "4.5pt", color: "#555",
                    lineHeight: 1, marginTop: "0.3mm",
                  }}>
                    SALE PRICE
                  </div>
                </>
              ) : (
                <>
                  <div style={{
                    fontSize: "5pt", fontWeight: 600,
                    color: "#555", lineHeight: 1,
                    letterSpacing: "0.3pt",
                  }}>
                    MRP
                  </div>
                  <div style={{
                    fontSize: "9pt", fontWeight: 900,
                    lineHeight: 1.1, whiteSpace: "nowrap",
                    overflow: "hidden", textOverflow: "ellipsis",
                  }}>
                    ₹{mrp}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Barcode + SKU text */}
        <div style={{
          padding: "0 1.5mm 0.5mm",
          flexShrink: 0,
          overflow: "hidden",
        }}>
          <BarcodePngImage value={p.sku} className="w-full" />
          <div style={{
            fontSize: "5pt", textAlign: "center",
            fontFamily: "monospace", letterSpacing: "0.4pt",
            lineHeight: 1, marginTop: "0.2mm",
          }}>
            {p.sku}
          </div>
        </div>

      </div>
    );
  }

  /* ── Screen / compact mode (unchanged) ── */
  const cardStyle: React.CSSProperties = {
    border: "1px solid #d1d5db",
    borderRadius: 10,
    overflow: "hidden",
    fontFamily: "'Segoe UI', Arial, sans-serif",
    background: "#ffffff",
    pageBreakInside: "avoid",
    breakInside: "avoid",
    width: compact ? 160 : undefined,
  };
  const stripStyle: React.CSSProperties = {
    background: hex.strip,
    padding: compact ? "4px 10px" : "5px 10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  };
  const bodyStyle: React.CSSProperties = {
    padding: compact ? "6px 8px" : "10px 10px 8px",
    textAlign: "center",
  };

  return (
    <div style={cardStyle}>
      <div style={stripStyle}>
        <span style={{ fontSize: compact ? 9 : 11, fontWeight: 800, color: "#fff", letterSpacing: 0.5 }}>
          {compact ? store.name.split(" ")[0] : store.name}
        </span>
        <span style={{ fontSize: compact ? 12 : 14 }}>{emoji}</span>
      </div>
      <div style={bodyStyle}>
        <div style={{
          display: "inline-block",
          background: hex.badge, color: hex.text,
          borderRadius: 20, fontSize: compact ? 8 : 9, fontWeight: 800,
          padding: "2px 8px", marginBottom: compact ? 4 : 8,
          letterSpacing: 0.5, textTransform: "uppercase",
        }}>
          {p.category}
        </div>
        <BarcodePngImage value={p.sku} className="w-full" />
        <div style={{
          fontSize: compact ? 10 : 12, fontWeight: 800, color: "#111827",
          lineHeight: 1.3, marginTop: compact ? 3 : 5,
          marginBottom: 3, minHeight: compact ? undefined : 30,
          overflow: "hidden", textOverflow: "ellipsis",
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
        }}>
          {p.name}
        </div>
        {showPrice && (
          <>
            <div style={{ borderTop: `2px solid ${hex.strip}`, margin: "5px 0" }} />
            {p.salePrice != null ? (
              <div>
                <div style={{ fontSize: compact ? 10 : 12, color: "#6b7280", textDecoration: "line-through" }}>
                  MRP ₹{Number(p.price).toLocaleString("en-IN")}
                </div>
                <div style={{ fontSize: compact ? 14 : 18, fontWeight: 900, color: "#dc2626" }}>
                  ₹{Number(p.salePrice).toLocaleString("en-IN")}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: compact ? 14 : 18, fontWeight: 900, color: "#111827" }}>
                ₹{Number(p.price).toLocaleString("en-IN")}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
