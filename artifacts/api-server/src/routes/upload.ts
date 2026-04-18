import { Router, type IRouter } from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";

const router: IRouter = Router();

/* Configure Cloudinary from the CLOUDINARY_URL env var (set automatically) */
cloudinary.config({
  cloudinary_url: process.env["CLOUDINARY_URL"],
});

/* Use memory storage — we stream the buffer directly to Cloudinary */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB max
  fileFilter(_req, file, cb) {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("Only image files are allowed"));
      return;
    }
    cb(null, true);
  },
});

/**
 * POST /api/upload/product-image
 * Accepts: multipart/form-data  { file: <image> }
 * Returns: { url, publicId }
 */
router.post(
  "/upload/product-image",
  upload.single("file"),
  async (req, res): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ error: "No file provided" });
      return;
    }

    try {
      const result = await new Promise<{ secure_url: string; public_id: string }>(
        (resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              folder:         "vishwakarma-complex/products",
              resource_type:  "image",
              transformation: [
                { width: 800, height: 800, crop: "limit", quality: "auto:good", fetch_format: "auto" },
              ],
            },
            (err, result) => {
              if (err || !result) reject(err ?? new Error("Upload failed"));
              else resolve(result as { secure_url: string; public_id: string });
            },
          );
          stream.end(req.file!.buffer);
        },
      );

      res.json({ url: result.secure_url, publicId: result.public_id });
    } catch (err: any) {
      res.status(500).json({ error: err.message ?? "Upload failed" });
    }
  },
);

/**
 * DELETE /api/upload/product-image
 * Body: { publicId: string }
 */
router.delete("/upload/product-image", async (req, res): Promise<void> => {
  const { publicId } = req.body as { publicId?: string };
  if (!publicId) {
    res.status(400).json({ error: "publicId is required" });
    return;
  }
  try {
    await cloudinary.uploader.destroy(publicId);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "Delete failed" });
  }
});

export default router;
