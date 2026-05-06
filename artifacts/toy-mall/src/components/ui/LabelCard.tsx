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

const HR: React.CSSProperties = {
  borderTop: "0.3mm solid #d1d5db",
  margin: 0, flexShrink: 0, border: "none",
  borderTopWidth: "0.3mm", borderTopStyle: "solid", borderTopColor: "#d1d5db",
};
const VR: React.CSSProperties = {
  width: "0.3mm", flexShrink: 0, alignSelf: "stretch",
  background: "#d1d5db",
};

export function LabelCard({ p, compact = false, printMode = false }: LabelCardProps) {
  const hex       = getCategoryHex(p.category);
  const emoji     = getCategoryEmoji(p.category);
  const store     = useStoreSettings();
  const showPrice = store.labelShowPrice ?? true;
  const hasSale   = showPrice && p.salePrice != null;
  const mrp       = Number(p.price).toLocaleString("en-IN");
  const sale      = hasSale ? Number(p.salePrice!).toLocaleString("en-IN") : null;

  /* ── Print mode: 100mm × 70mm premium retail price tag ── */
  if (printMode) {
    return (
      <div style={{
        width: "100%", height: "100%",
        fontFamily: "Arial, 'Helvetica Neue', sans-serif",
        background: "#fff", color: "#000",
        display: "flex", flexDirection: "column",
        boxSizing: "border-box",
        overflow: "hidden",
        border: "0.4mm solid #bbb",
        borderRadius: "2mm",
      }}>

        {/* ══ ROW 1 (22mm): Store branding + Price ══ */}
        <div style={{
          display: "flex", flexDirection: "row",
          alignItems: "stretch",
          flex: "0 0 22mm", minHeight: 0,
        }}>

          {/* Store identity — grows to fill remaining width */}
          <div style={{
            flex: 1, minWidth: 0,
            display: "flex", alignItems: "center",
            gap: "2.5mm", padding: "2mm 3mm",
            overflow: "hidden",
          }}>
            {/* Emoji box */}
            <div style={{
              width: "12mm", height: "12mm", flexShrink: 0,
              border: "0.5mm solid #000", borderRadius: "1.5mm",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "7mm", lineHeight: 1,
            }}>
              {store.logoEmoji}
            </div>
            <div style={VR} />
            {/* Store name + tagline */}
            <div style={{ minWidth: 0, overflow: "hidden" }}>
              <div style={{
                fontSize: "4.5mm", fontWeight: 900,
                lineHeight: 1.15, letterSpacing: "0.2mm",
                textTransform: "uppercase",
                overflow: "hidden",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
              } as React.CSSProperties}>
                {store.name}
              </div>
              <div style={{
                fontSize: "2.8mm", fontWeight: 500, color: "#555",
                letterSpacing: "0.5mm", textTransform: "uppercase",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                marginTop: "0.5mm",
              }}>
                {store.tagline}
              </div>
            </div>
          </div>

          {/* Price block — fixed width, never squeezed */}
          {showPrice && (
            <>
              <div style={VR} />
              {hasSale ? (
                <div style={{
                  display: "flex", flexDirection: "row",
                  alignItems: "stretch", flexShrink: 0,
                }}>
                  {/* MRP strikethrough column */}
                  <div style={{
                    width: "22mm",
                    display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center",
                    padding: "1mm 2mm",
                  }}>
                    <div style={{
                      fontSize: "2.8mm", fontWeight: 700, color: "#666",
                      letterSpacing: "0.3mm", textTransform: "uppercase",
                      lineHeight: 1,
                    }}>
                      MRP
                    </div>
                    <div style={{
                      fontSize: "5.5mm", fontWeight: 800, color: "#444",
                      textDecoration: "line-through", lineHeight: 1.1,
                      whiteSpace: "nowrap",
                    }}>
                      ₹{mrp}
                    </div>
                  </div>
                  <div style={VR} />
                  {/* Sale price black box */}
                  <div style={{
                    width: "30mm",
                    background: "#000", color: "#fff",
                    display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center",
                    padding: "1mm 2mm",
                    borderRadius: "0 2mm 0 0",
                    printColorAdjust: "exact",
                    WebkitPrintColorAdjust: "exact",
                  } as React.CSSProperties}>
                    <div style={{
                      fontSize: "2.5mm", fontWeight: 700,
                      letterSpacing: "0.5mm", textTransform: "uppercase",
                      lineHeight: 1,
                    }}>
                      SALE PRICE
                    </div>
                    <div style={{
                      fontSize: "8mm", fontWeight: 900, lineHeight: 1.05,
                      whiteSpace: "nowrap",
                    }}>
                      ₹ {sale}
                    </div>
                    <div style={{
                      fontSize: "2mm", color: "#bbb",
                      whiteSpace: "nowrap", marginTop: "0.5mm",
                    }}>
                      (Incl. of all taxes)
                    </div>
                  </div>
                </div>
              ) : (
                /* MRP only box */
                <div style={{
                  width: "28mm", flexShrink: 0,
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                  padding: "1mm 2mm",
                }}>
                  <div style={{
                    fontSize: "2.8mm", fontWeight: 700, color: "#666",
                    letterSpacing: "0.3mm", textTransform: "uppercase",
                    lineHeight: 1,
                  }}>
                    MRP
                  </div>
                  <div style={{
                    fontSize: "7.5mm", fontWeight: 900, lineHeight: 1.05,
                    whiteSpace: "nowrap",
                  }}>
                    ₹{mrp}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Horizontal rule */}
        <div style={HR} />

        {/* ══ ROW 2 (grows): Product name + Category ══ */}
        <div style={{
          display: "flex", flexDirection: "row",
          alignItems: "stretch",
          flex: 1, minHeight: 0,
        }}>
          {/* Product name */}
          <div style={{
            flex: "0 0 62%", minWidth: 0,
            padding: "2mm 3mm",
            display: "flex", flexDirection: "column", justifyContent: "center",
            overflow: "hidden",
          }}>
            <div style={{
              fontSize: "6.5mm", fontWeight: 900, lineHeight: 1.2,
              letterSpacing: "-0.1mm",
              overflow: "hidden", textOverflow: "ellipsis",
              display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
            } as React.CSSProperties}>
              {p.name}
            </div>
          </div>

          <div style={VR} />

          {/* Category */}
          <div style={{
            flex: 1, minWidth: 0,
            padding: "2mm 2.5mm",
            display: "flex", flexDirection: "column",
            alignItems: "flex-start", justifyContent: "center",
            overflow: "hidden",
          }}>
            <div style={{
              width: "8mm", height: "8mm", flexShrink: 0,
              borderRadius: "50%",
              border: "0.5mm solid #000",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "4.5mm", marginBottom: "1.5mm",
            }}>
              {emoji}
            </div>
            <div style={{
              fontSize: "3mm", fontWeight: 800,
              letterSpacing: "0.3mm", textTransform: "uppercase",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              maxWidth: "100%",
            }}>
              {p.category}
            </div>
            <div style={{
              fontSize: "2.5mm", color: "#666", marginTop: "0.5mm",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {store.tagline}
            </div>
          </div>
        </div>

        {/* Horizontal rule */}
        <div style={HR} />

        {/* ══ ROW 3 (22mm): SKU + Barcode ══ */}
        <div style={{
          display: "flex", flexDirection: "row",
          alignItems: "stretch",
          flex: "0 0 22mm", minHeight: 0,
        }}>
          {/* SKU */}
          <div style={{
            flexShrink: 0, width: "18mm",
            padding: "2mm 2.5mm",
            display: "flex", flexDirection: "column",
            justifyContent: "center",
          }}>
            <div style={{
              fontSize: "2.5mm", color: "#888", fontWeight: 600,
              letterSpacing: "0.3mm", textTransform: "uppercase",
              lineHeight: 1,
            }}>
              SKU
            </div>
            <div style={{
              fontSize: "4mm", fontWeight: 900, lineHeight: 1.2,
              fontFamily: "monospace", letterSpacing: "0.1mm",
              whiteSpace: "nowrap",
              overflow: "hidden", textOverflow: "ellipsis",
            }}>
              {p.sku}
            </div>
          </div>

          <div style={VR} />

          {/* Barcode */}
          <div style={{
            flex: 1, minWidth: 0,
            padding: "1.5mm 3mm 1mm",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            overflow: "hidden",
          }}>
            <div style={{ width: "100%", flex: 1, minHeight: 0, overflow: "hidden", display: "flex", alignItems: "center" }}>
              <BarcodePngImage value={p.sku} className="w-full" />
            </div>
            <div style={{
              fontSize: "2.8mm", textAlign: "center",
              fontFamily: "monospace", letterSpacing: "0.5mm",
              marginTop: "0.5mm", lineHeight: 1, flexShrink: 0,
            }}>
              {p.sku}
            </div>
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
