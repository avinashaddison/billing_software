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

const S = {
  root: {
    width: "100%", height: "100%",
    fontFamily: "Arial, 'Helvetica Neue', sans-serif",
    background: "#fff", color: "#000",
    display: "flex", flexDirection: "column" as const,
    boxSizing: "border-box" as const,
    overflow: "hidden",
    border: "0.4mm solid #ccc",
    borderRadius: "1.5mm",
  },
  hr: {
    borderTop: "0.3mm solid #d1d5db",
    margin: 0, flexShrink: 0,
  },
  vr: {
    borderLeft: "0.3mm solid #d1d5db",
    alignSelf: "stretch", flexShrink: 0,
  },
};

export function LabelCard({ p, compact = false, printMode = false }: LabelCardProps) {
  const hex       = getCategoryHex(p.category);
  const emoji     = getCategoryEmoji(p.category);
  const store     = useStoreSettings();
  const showPrice = store.labelShowPrice ?? true;
  const hasSale   = p.salePrice != null && showPrice;
  const mrp       = Number(p.price).toLocaleString("en-IN");
  const sale      = hasSale ? Number(p.salePrice).toLocaleString("en-IN") : null;

  /* ── Thermal print mode: 80mm × 50mm, premium 3-row retail label ── */
  if (printMode) {
    return (
      <div style={S.root}>

        {/* ══ ROW 1: Store branding + Price ══ */}
        <div style={{
          display: "flex", flexDirection: "row",
          alignItems: "stretch", flexShrink: 0,
          minHeight: "16mm",
        }}>
          {/* Store identity */}
          <div style={{
            flex: 1, display: "flex", alignItems: "center",
            gap: "2mm", padding: "1.5mm 2mm",
            overflow: "hidden",
          }}>
            {/* Emoji icon box */}
            <div style={{
              width: "8mm", height: "8mm", flexShrink: 0,
              border: "0.4mm solid #000",
              borderRadius: "1mm",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "5mm", lineHeight: 1,
            }}>
              {store.logoEmoji}
            </div>
            {/* Vertical rule */}
            <div style={{ ...S.vr, height: "8mm" }} />
            {/* Name + tagline */}
            <div style={{ overflow: "hidden", minWidth: 0 }}>
              <div style={{
                fontSize: "4.2mm", fontWeight: 900,
                lineHeight: 1.15, letterSpacing: "0.3mm",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                textTransform: "uppercase",
              }}>
                {store.name}
              </div>
              <div style={{
                fontSize: "2.8mm", fontWeight: 500, color: "#555",
                letterSpacing: "0.4mm", textTransform: "uppercase",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>
                {store.tagline}
              </div>
            </div>
          </div>

          {/* Price section */}
          {showPrice && (
            <>
              <div style={S.vr} />
              {hasSale ? (
                /* MRP strikethrough + Sale price black box */
                <div style={{
                  display: "flex", alignItems: "stretch", flexShrink: 0,
                }}>
                  {/* MRP column */}
                  <div style={{
                    display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center",
                    padding: "1.5mm 2.5mm",
                  }}>
                    <div style={{
                      fontSize: "2.5mm", fontWeight: 700, color: "#555",
                      letterSpacing: "0.3mm", textTransform: "uppercase",
                    }}>
                      MRP
                    </div>
                    <div style={{
                      fontSize: "5mm", fontWeight: 800, color: "#333",
                      textDecoration: "line-through", lineHeight: 1.1,
                      whiteSpace: "nowrap",
                    }}>
                      ₹{mrp}
                    </div>
                  </div>
                  <div style={S.vr} />
                  {/* Sale price box */}
                  <div style={{
                    background: "#000", color: "#fff",
                    display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center",
                    padding: "1.5mm 3mm",
                    borderRadius: "0 1.5mm 0 0",
                    printColorAdjust: "exact",
                    WebkitPrintColorAdjust: "exact",
                    minWidth: "22mm",
                  } as React.CSSProperties}>
                    <div style={{
                      fontSize: "2.5mm", fontWeight: 700,
                      letterSpacing: "0.4mm", textTransform: "uppercase",
                      marginBottom: "0.3mm",
                    }}>
                      SALE PRICE
                    </div>
                    <div style={{
                      fontSize: "7mm", fontWeight: 900, lineHeight: 1,
                      whiteSpace: "nowrap",
                    }}>
                      ₹ {sale}
                    </div>
                    <div style={{
                      fontSize: "2mm", marginTop: "0.5mm",
                      color: "#ccc", whiteSpace: "nowrap",
                    }}>
                      (Incl. of all taxes)
                    </div>
                  </div>
                </div>
              ) : (
                /* MRP only */
                <div style={{
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                  padding: "1.5mm 3.5mm", flexShrink: 0,
                }}>
                  <div style={{
                    fontSize: "2.5mm", fontWeight: 700, color: "#555",
                    letterSpacing: "0.3mm", textTransform: "uppercase",
                  }}>
                    MRP
                  </div>
                  <div style={{
                    fontSize: "6.5mm", fontWeight: 900, lineHeight: 1,
                    whiteSpace: "nowrap",
                  }}>
                    ₹{mrp}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <hr style={S.hr} />

        {/* ══ ROW 2: Product name + Category ══ */}
        <div style={{
          display: "flex", flexDirection: "row",
          alignItems: "stretch", flex: 1, overflow: "hidden",
          minHeight: "18mm",
        }}>
          {/* Product name */}
          <div style={{
            flex: "0 0 62%", padding: "1.5mm 2.5mm",
            display: "flex", flexDirection: "column", justifyContent: "center",
            overflow: "hidden",
          }}>
            <div style={{
              fontSize: "5.8mm", fontWeight: 900, lineHeight: 1.2,
              overflow: "hidden", textOverflow: "ellipsis",
              display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
              letterSpacing: "-0.1mm",
            } as React.CSSProperties}>
              {p.name}
            </div>
          </div>

          <div style={S.vr} />

          {/* Category */}
          <div style={{
            flex: 1, padding: "1.5mm 2mm",
            display: "flex", flexDirection: "column",
            alignItems: "flex-start", justifyContent: "center",
            overflow: "hidden",
          }}>
            <div style={{
              width: "7mm", height: "7mm",
              borderRadius: "50%",
              border: "0.4mm solid #000",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "3.8mm", marginBottom: "1mm", flexShrink: 0,
            }}>
              {emoji}
            </div>
            <div style={{
              fontSize: "2.8mm", fontWeight: 800,
              letterSpacing: "0.3mm", textTransform: "uppercase",
              lineHeight: 1.2,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              maxWidth: "100%",
            }}>
              {p.category}
            </div>
            <div style={{
              fontSize: "2.3mm", color: "#666", marginTop: "0.5mm",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>
              {store.tagline}
            </div>
          </div>
        </div>

        <hr style={S.hr} />

        {/* ══ ROW 3: SKU + Barcode ══ */}
        <div style={{
          display: "flex", flexDirection: "row",
          alignItems: "stretch", flexShrink: 0,
          minHeight: "14mm",
        }}>
          {/* SKU */}
          <div style={{
            padding: "1.5mm 2mm", flexShrink: 0,
            display: "flex", flexDirection: "column",
            justifyContent: "center", minWidth: "14mm",
          }}>
            <div style={{
              fontSize: "2.5mm", color: "#888", fontWeight: 600,
              letterSpacing: "0.3mm", textTransform: "uppercase", lineHeight: 1,
            }}>
              SKU
            </div>
            <div style={{
              fontSize: "4mm", fontWeight: 900, lineHeight: 1.2,
              fontFamily: "monospace", letterSpacing: "0.2mm",
              whiteSpace: "nowrap",
            }}>
              {p.sku}
            </div>
          </div>

          <div style={S.vr} />

          {/* Barcode */}
          <div style={{
            flex: 1, padding: "1mm 2mm 0.5mm",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            overflow: "hidden",
          }}>
            <BarcodePngImage value={p.sku} className="w-full" />
            <div style={{
              fontSize: "2.5mm", textAlign: "center",
              fontFamily: "monospace", letterSpacing: "0.5mm",
              marginTop: "0.3mm", lineHeight: 1,
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
