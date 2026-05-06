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

  /* ── Thermal print mode: 50mm × 25mm, single-column Motoomal style ── */
  if (printMode) {
    return (
      <div style={{
        width: "100%",
        height: "100%",
        fontFamily: "Arial, 'Helvetica Neue', sans-serif",
        background: "#fff",
        color: "#000",
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
        overflow: "hidden",
      }}>

        {/* Store name — centred black banner */}
        <div style={{
          background: "#000",
          color: "#fff",
          textAlign: "center",
          fontSize: 8, fontWeight: 900,
          letterSpacing: 1.5,
          textTransform: "uppercase",
          padding: "0.7mm 2mm",
          flexShrink: 0,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}>
          {store.name}
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "0.8mm 2mm 0.5mm",
          overflow: "hidden",
        }}>

          {/* Product name + SKU */}
          <div>
            <div style={{
              fontSize: 8, fontWeight: 700, lineHeight: 1.2,
              overflow: "hidden", textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}>
              {p.name}
            </div>
            <div style={{
              fontSize: 6.5, fontFamily: "monospace", color: "#444",
              letterSpacing: 0.3, lineHeight: 1.2,
            }}>
              {p.sku}
            </div>
          </div>

          {/* Price */}
          {showPrice && (
            <div style={{ lineHeight: 1.15 }}>
              {p.salePrice != null ? (
                <>
                  <div style={{
                    fontSize: 8, fontWeight: 700,
                    textDecoration: "line-through", color: "#222",
                  }}>
                    MRP: {Number(p.price).toLocaleString("en-IN")}
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 900 }}>
                    SALE: {Number(p.salePrice).toLocaleString("en-IN")}
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 9, fontWeight: 800 }}>
                  MRP: ₹{Number(p.price).toLocaleString("en-IN")}
                </div>
              )}
            </div>
          )}

          {/* Barcode + number */}
          <div style={{ overflow: "hidden" }}>
            <BarcodePngImage value={p.sku} className="w-full" />
            <div style={{
              fontSize: 6.5, textAlign: "center",
              fontFamily: "monospace", letterSpacing: 0.5,
            }}>
              {p.sku}
            </div>
          </div>

        </div>
      </div>
    );
  }

  /* ── Screen / compact mode ── */
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
