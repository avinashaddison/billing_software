import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { ScanLine, Keyboard, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { playScanBeep } from "@/lib/sounds";

export default function Scan() {
  const [, setLocation] = useLocation();
  const [manualSku, setManualSku] = useState("");
  const [scannerActive, setScannerActive] = useState(true);

  useEffect(() => {
    let scanner: Html5QrcodeScanner | null = null;

    if (scannerActive) {
      scanner = new Html5QrcodeScanner(
        "reader",
        { 
          fps: 10, 
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1,
          videoConstraints: { facingMode: "environment" },
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE, Html5QrcodeSupportedFormats.CODE_128, Html5QrcodeSupportedFormats.EAN_13]
        },
        false
      );

      scanner.render(
        (decodedText) => {
          // Stop scanning on success
          if (scanner) {
            scanner.clear();
            setScannerActive(false);
          }

          playScanBeep();

          // Handle decoded text. If it's a URL containing sku, extract it. Otherwise assume it IS the sku.
          try {
            if (decodedText.includes("product?sku=")) {
              const url = new URL(decodedText.startsWith("http") ? decodedText : `http://localhost${decodedText}`);
              const sku = url.searchParams.get("sku");
              if (sku) {
                setTimeout(() => setLocation(`/product?sku=${sku}`), 200);
                return;
              }
            }
          } catch (e) {
            // Not a URL, use raw text
          }

          setTimeout(() => setLocation(`/product?sku=${decodedText}`), 200);
        },
        (error) => {
          // Ignored - runs constantly when no QR is found
        }
      );
    }

    return () => {
      if (scanner) {
        scanner.clear().catch(console.error);
      }
    };
  }, [scannerActive, setLocation]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualSku.trim()) {
      setLocation(`/product?sku=${manualSku.trim().toUpperCase()}`);
    }
  };

  return (
    <div className="flex flex-col h-full bg-black text-white">
      <div className="p-4 flex items-center justify-between sticky top-0 z-10 bg-black/50 backdrop-blur-md">
        <h1 className="text-xl font-black">Scan Product</h1>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-4 relative">
        <div className="w-full max-w-sm aspect-square bg-white/5 rounded-3xl overflow-hidden shadow-2xl border border-white/10 relative">
          {scannerActive ? (
            <div id="reader" className="w-full h-full [&>div]:border-none [&>div>video]:object-cover" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
              <ScanLine className="w-16 h-16 mb-4 opacity-50" />
              <p>Scanner paused</p>
              <Button variant="outline" className="mt-4 text-black" onClick={() => setScannerActive(true)}>
                Resume Scanner
              </Button>
            </div>
          )}
          
          {/* Overlay scanner box graphic */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-48 h-48 border-2 border-primary/50 rounded-xl relative">
              <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-primary rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-primary rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-primary rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-primary rounded-br-lg" />
              <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-primary/80 animate-[scan_2s_ease-in-out_infinite]" />
            </div>
          </div>
        </div>
        <p className="mt-6 text-center font-medium text-white/70">Point camera at QR code or barcode</p>
      </div>

      <div className="bg-zinc-900 rounded-t-3xl p-6 shadow-2xl pb-32">
        <div className="flex items-center gap-2 mb-4 text-white/80">
          <Keyboard className="w-5 h-5" />
          <h2 className="font-bold">Manual Entry</h2>
        </div>
        
        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <Input 
            value={manualSku}
            onChange={(e) => setManualSku(e.target.value)}
            placeholder="Enter SKU..."
            className="h-14 text-lg bg-black/50 border-white/10 text-white placeholder:text-white/30 rounded-xl font-mono uppercase"
            data-testid="input-sku-manual"
          />
          <Button type="submit" className="h-14 px-6 rounded-xl font-bold active:scale-95" disabled={!manualSku.trim()}>
            Go <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </form>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes scan {
          0% { transform: translateY(-100px); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(100px); opacity: 0; }
        }
        #reader button {
          background: white;
          color: black;
          border: none;
          padding: 8px 16px;
          border-radius: 8px;
          font-weight: bold;
          margin-top: 10px;
        }
        #reader a { color: white; display: none; }
        #reader__dashboard_section_csr { padding: 20px 0; }
      `}} />
    </div>
  );
}
