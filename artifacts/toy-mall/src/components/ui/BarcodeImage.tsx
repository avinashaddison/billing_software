import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

interface BarcodeImageProps {
  value: string;
  height?: number;
  fontSize?: number;
  className?: string;
}

export function BarcodeImage({ value, height = 80, fontSize = 14, className }: BarcodeImageProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !value) return;
    try {
      JsBarcode(svgRef.current, value, {
        format: "CODE128",
        height,
        fontSize,
        fontOptions: "bold",
        textMargin: 6,
        margin: 10,
        displayValue: true,
        lineColor: "#000000",
        background: "#ffffff",
      });
    } catch {
      // invalid value — render nothing
    }
  }, [value, height, fontSize]);

  return <svg ref={svgRef} className={className} />;
}

export function barcodeSvgDataUrl(value: string, height = 80): string {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  try {
    JsBarcode(svg, value, {
      format: "CODE128",
      height,
      fontSize: 14,
      fontOptions: "bold",
      textMargin: 6,
      margin: 10,
      displayValue: true,
      lineColor: "#000000",
      background: "#ffffff",
    });
  } catch {
    return "";
  }
  const serialized = new XMLSerializer().serializeToString(svg);
  return "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(serialized)));
}
