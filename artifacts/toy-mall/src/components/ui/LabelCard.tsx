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

export function LabelCard({ p, compact = false }: { p: LabelProduct; compact?: boolean }) {
  const hex       = getCategoryHex(p.category);
  const emoji     = getCategoryEmoji(p.category);
  const store     = useStoreSettings();
  const showPrice = store.labelShowPrice ?? true;

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
                  MRP ₹{p.price.toLocaleString("en-IN")}
                </div>
                <div style={{ fontSize: compact ? 14 : 18, fontWeight: 900, color: "#dc2626" }}>
                  ₹{p.salePrice.toLocaleString("en-IN")}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: compact ? 14 : 18, fontWeight: 900, color: "#111827" }}>
                ₹{p.price.toLocaleString("en-IN")}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
