import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";

let s3ClientInstance: S3Client | null = null;

function ensureEnvLoaded() {
  if (
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME
  ) {
    return;
  }

  try {
    const envPath = path.join(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const [k, ...rest] = trimmed.split("=");
        const key = k.trim();
        const val = rest.join("=").trim();
        if (key && val && !process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  } catch {
    // Ignore error
  }
}

export function isR2Configured(): boolean {
  ensureEnvLoaded();
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME
  );
}

export function getR2Client(): S3Client {
  ensureEnvLoaded();
  if (s3ClientInstance) return s3ClientInstance;

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Cloudflare R2 is not fully configured. Please set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY in your .env file."
    );
  }

  s3ClientInstance = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  return s3ClientInstance;
}

/**
 * Uploads a file (such as a WebP image) to Cloudflare R2 bucket.
 * Returns the public or access URL of the uploaded object.
 */
export async function uploadToR2(
  key: string,
  data: Buffer | Uint8Array,
  contentType: string = "image/webp"
): Promise<string> {
  ensureEnvLoaded();
  const bucketName = process.env.R2_BUCKET_NAME;
  if (!bucketName) {
    throw new Error("R2_BUCKET_NAME is not set in environment variables.");
  }

  const client = getR2Client();
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: data,
    ContentType: contentType,
  });

  await client.send(command);

  // Build the public URL
  const publicBaseUrl = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");
  if (publicBaseUrl) {
    return `${publicBaseUrl}/${key}`;
  }

  // Fallback to standard Cloudflare R2 public format if configured with public dev domain
  const accountId = process.env.R2_ACCOUNT_ID;
  return `https://${bucketName}.${accountId}.r2.cloudflarestorage.com/${key}`;
}

/**
 * Deletes an object from the Cloudflare R2 bucket by key.
 */
export async function deleteFromR2(key: string): Promise<void> {
  ensureEnvLoaded();
  const bucketName = process.env.R2_BUCKET_NAME;
  if (!bucketName) {
    throw new Error("R2_BUCKET_NAME is not set in environment variables.");
  }

  const client = getR2Client();
  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  await client.send(command);
}

/**
 * Retrieves an object from Cloudflare R2 as a byte array with content type.
 */
export async function getObjectFromR2(
  key: string
): Promise<{ body: Uint8Array; contentType: string } | null> {
  ensureEnvLoaded();
  const bucketName = process.env.R2_BUCKET_NAME;
  if (!bucketName) return null;

  try {
    const client = getR2Client();
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    const res = await client.send(command);
    if (!res.Body) return null;

    const bytes = await res.Body.transformToByteArray();
    return {
      body: bytes,
      contentType: res.ContentType || "image/webp",
    };
  } catch (err: any) {
    console.error("Error retrieving object from R2:", err?.message);
    return null;
  }
}

/**
 * Deletes all objects under a specific folder prefix in Cloudflare R2.
 */
export async function deleteFolderFromR2(prefix: string): Promise<void> {
  ensureEnvLoaded();
  const bucketName = process.env.R2_BUCKET_NAME;
  if (!bucketName) return;

  try {
    const client = getR2Client();
    const listRes = await client.send(
      new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: prefix,
      })
    );

    if (listRes.Contents && listRes.Contents.length > 0) {
      const objectsToDelete = listRes.Contents
        .map((item) => ({ Key: item.Key }))
        .filter((item): item is { Key: string } => Boolean(item.Key));

      if (objectsToDelete.length > 0) {
        await client.send(
          new DeleteObjectsCommand({
            Bucket: bucketName,
            Delete: {
              Objects: objectsToDelete,
            },
          })
        );
      }
    }
  } catch (err: any) {
    console.error("Error deleting folder prefix from R2:", err?.message);
  }
}
