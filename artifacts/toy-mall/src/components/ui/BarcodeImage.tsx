import { useEffect, useRef, useMemo } from "react";
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

/**
 * Renders barcode to a canvas and returns a PNG data URL.
 * PNG is preferred for download/print — no scaling artefacts, bars stay crisp.
 * width=4 (px per bar) + margin=40 ensures generous quiet zones at any print size.
 */
export function barcodePngDataUrl(value: string): string {
  const canvas = document.createElement("canvas");
  try {
    JsBarcode(canvas, value, {
      format:       "CODE128",
      width:        4,
      height:       120,
      fontSize:     20,
      fontOptions:  "bold",
      textMargin:   10,
      margin:       40,
      displayValue: true,
      lineColor:    "#000000",
      background:   "#ffffff",
    });
  } catch {
    return "";
  }
  return canvas.toDataURL("image/png");
}

/**
 * Generates a label-sized barcode PNG — bars are narrow enough that the image
 * fits the label card width without heavy downscaling.  pixelated rendering
 * prevents anti-aliasing from blurring bars when any scaling does occur.
 */
export function barcodeLabelPngDataUrl(value: string): string {
  const canvas = document.createElement("canvas");
  try {
    JsBarcode(canvas, value, {
      format:       "CODE128",
      width:        4,      // 4 px per bar → high-res; scales DOWN to label width = crisp bars
      height:       100,
      fontSize:     14,
      fontOptions:  "bold",
      textMargin:   0,
      margin:       8,
      displayValue: false,
      lineColor:    "#000000",
      background:   "#ffffff",
    });
  } catch {
    return "";
  }
  return canvas.toDataURL("image/png");
}

/**
 * Renders barcode as a PNG <img> element — guaranteed crisp on screen AND print.
 * Use this inside LabelCard and any print layout instead of <BarcodeImage>.
 */
export function BarcodePngImage({ value, className }: { value: string; className?: string }) {
  const src = useMemo(() => barcodeLabelPngDataUrl(value), [value]);
  if (!src) return null;
  return (
    <img
      src={src}
      alt={value}
      className={className}
      style={{
        width: "100%",
        height: "auto",
        display: "block",
        imageRendering: "pixelated",   // no anti-aliasing blur when scaling
      }}
    />
  );
}
