import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const UPLOAD_FOLDER = "herbsvedic/products";

/**
 * Generates a short-lived signature the FRONTEND uses to upload
 * directly to Cloudinary - the image bytes never pass through our own
 * server at all, only this small signed permission slip does. The
 * signature is computed over the exact same params the frontend must
 * send back with the actual upload (timestamp + folder) - if either
 * value is tampered with after signing, Cloudinary's own verification
 * rejects the upload, not ours.
 */
export function generateUploadSignature(): {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
} {
  const timestamp = Math.round(Date.now() / 1000);

  const signature = cloudinary.utils.api_sign_request(
    { timestamp, folder: UPLOAD_FOLDER },
    process.env.CLOUDINARY_API_SECRET!
  );

  return {
    signature,
    timestamp,
    apiKey: process.env.CLOUDINARY_API_KEY!,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME!,
    folder: UPLOAD_FOLDER,
  };
}