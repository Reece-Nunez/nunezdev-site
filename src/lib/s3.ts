import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand, CopyObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({
  region: process.env.S3_REGION || 'us-east-2',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'nunezdev-client-uploads';

export interface PresignedUrlParams {
  key: string;
  contentType: string;
  expiresIn?: number;
}

export async function generatePresignedUploadUrl({
  key,
  contentType,
  expiresIn = 3600,
}: PresignedUrlParams): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  return getSignedUrl(s3Client, command, { expiresIn });
}

export async function generatePresignedDownloadUrl(
  key: string,
  expiresIn = 3600,
  fileName?: string
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ResponseContentDisposition: fileName
      ? `attachment; filename="${fileName}"`
      : 'attachment',
  });

  return getSignedUrl(s3Client, command, { expiresIn });
}

export async function getS3Object(key: string) {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });
  return s3Client.send(command);
}

/**
 * Server-side upload of raw bytes to S3. Used to re-host inbound MMS media
 * (fetched from Twilio) into our own bucket, so a stored `key` drives the same
 * presigned-view render path as every other attachment — and so the image
 * survives Twilio deleting its short-lived copy.
 */
export async function putS3Object(
  key: string,
  body: Uint8Array | Buffer,
  contentType: string,
): Promise<void> {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: body,
    ContentType: contentType,
  });
  await s3Client.send(command);
}

export async function deleteS3Object(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  await s3Client.send(command);
}

export function buildS3Key(
  clientName: string,
  projectName: string,
  fileName: string
): string {
  const timestamp = Date.now();
  const sanitizedClient = clientName.replace(/[^a-zA-Z0-9 -]/g, '').trim();
  const sanitizedProject = projectName.replace(/[^a-zA-Z0-9 -]/g, '').trim();
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `${sanitizedProject} - ${sanitizedClient}/${timestamp}_${sanitizedFileName}`;
}

export function getPublicUrl(key: string): string {
  return `https://${BUCKET_NAME}.s3.${process.env.S3_REGION || 'us-east-2'}.amazonaws.com/${key}`;
}

/**
 * Presigned GET URL WITHOUT a content-disposition override, so the browser
 * renders the object inline (e.g. an <img src>) instead of forcing a download.
 * Used to show inbox image attachments inside a thread. The bucket is private,
 * so each view needs a fresh short-lived signed URL.
 */
export async function generatePresignedViewUrl(
  key: string,
  expiresIn = 3600,
): Promise<string> {
  const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key });
  return getSignedUrl(s3Client, command, { expiresIn });
}

/**
 * Copy an S3 object from `fromKey` to `toKey` inside the same bucket.
 * Returns true on success, false on failure (caller decides whether to retry).
 */
export async function copyS3Object(fromKey: string, toKey: string): Promise<boolean> {
  try {
    const command = new CopyObjectCommand({
      Bucket: BUCKET_NAME,
      CopySource: `${BUCKET_NAME}/${encodeURIComponent(fromKey)}`,
      Key: toKey,
      MetadataDirective: 'COPY',
    });
    await s3Client.send(command);
    return true;
  } catch (err) {
    console.error('[s3 copyS3Object] failed', { fromKey, toKey, err });
    return false;
  }
}

export async function checkFileExists(key: string): Promise<boolean> {
  try {
    const command = new HeadObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });
    await s3Client.send(command);
    return true;
  } catch {
    return false;
  }
}
