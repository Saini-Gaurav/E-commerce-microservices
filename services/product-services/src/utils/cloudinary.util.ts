import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const UPLOAD_FOLDER = "herbsvedic/products";

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

function extractPublicId(cloudinaryUrl: string): string | null {
  const match = cloudinaryUrl.match(/\/upload\/(?:v\d+\/)?(.+?)\.\w+$/);
  return match ? match[1] : null;
}

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