import { useRef, useState } from "react";
import { ImageIcon, Upload, X, Loader2, Camera } from "lucide-react";
import { toast } from "sonner";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface ImageUploaderProps {
  value?: string | null;
  onChange: (url: string) => void;
  onClear?: () => void;
  label?: string;
  className?: string;
}

export function ImageUploader({ value, onChange, onClear, label = "Product Image", className = "" }: ImageUploaderProps) {
  const fileRef  = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver]   = useState(false);

  const upload = async (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Only image files allowed"); return; }
    if (file.size > 8 * 1024 * 1024) { toast.error("Image must be under 8 MB"); return; }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch(`${BASE_URL}/api/upload/product-image`, { method: "POST", body: fd });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Upload failed");
      onChange(data.url);
      toast.success("Image uploaded");
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleFile = (f: File | null | undefined) => { if (f) upload(f); };

  return (
    <div className={className}>
      <p className="text-sm font-bold text-muted-foreground mb-1.5 flex items-center gap-1.5">
        <ImageIcon className="w-3.5 h-3.5" />
        {label}
        <span className="text-xs font-normal normal-case">(optional)</span>
      </p>

      {value ? (
        /* Preview + replace/clear */
        <div className="relative inline-block group">
          <img
            src={value}
            alt="Product"
            className="w-32 h-32 rounded-2xl object-cover border-2 border-border shadow-sm"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
          <div className="absolute inset-0 bg-black/50 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center text-white transition-all"
              title="Replace image"
            >
              <Camera className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => { onChange(""); onClear?.(); }}
              className="w-8 h-8 rounded-full bg-red-500/80 hover:bg-red-500 flex items-center justify-center text-white transition-all"
              title="Remove image"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        /* Drop zone */
        <div
          className={`relative border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
            dragOver
              ? "border-primary bg-primary/5 scale-[1.01]"
              : "border-muted-foreground/30 hover:border-primary/50 hover:bg-primary/5"
          } ${uploading ? "pointer-events-none opacity-60" : ""}`}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFile(e.dataTransfer.files[0]);
          }}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm font-bold text-primary">Uploading…</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                <Upload className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-bold text-foreground">Tap to upload or drag & drop</p>
              <p className="text-xs text-muted-foreground">PNG, JPG, WEBP · max 8 MB</p>
            </div>
          )}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
  );
}
