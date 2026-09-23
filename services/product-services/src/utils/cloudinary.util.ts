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

/**
 * Cloudinary identifies files by "public_id," not by the full URL -
 * extracting it means parsing the URL Cloudinary itself gave us back
 * at upload time. A typical URL looks like:
 *   https://res.cloudinary.com/<cloud>/image/upload/v169.../herbsvedic/products/abc123.jpg
 * The public_id is everything after the version segment (v169...),
 * with the file extension stripped - in this case
 * "herbsvedic/products/abc123".
 */
function extractPublicId(cloudinaryUrl: string): string | null {
  const match = cloudinaryUrl.match(/\/upload\/(?:v\d+\/)?(.+?)\.\w+$/);
  return match ? match[1] : null;
}

/**
 * Best-effort delete - logs and swallows any failure rather than
 * throwing. Reasoning: if Cloudinary's API is briefly down, or a URL
 * doesn't parse cleanly for some reason, that should NEVER block the
 * actual product deletion the admin asked for. A stray orphaned image
 * costing a few KB of storage is a much smaller problem than an admin
 * being unable to delete a product because an unrelated third-party
 * API had a bad moment.
 */
export async function deleteCloudinaryImage(imageUrl: string): Promise<void> {
  if (!imageUrl || !imageUrl.includes("cloudinary.com")) return; // skip non-Cloudinary URLs (e.g. old picsum.photos seed data) entirely

  const publicId = extractPublicId(imageUrl);
  if (!publicId) {
    console.warn(`Couldn't extract Cloudinary public_id from: ${imageUrl}`);
    return;
  }

  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.error(`Failed to delete Cloudinary image ${publicId}:`, err);
  }
}