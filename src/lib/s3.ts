import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
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
  expiresIn = 3600
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  return getSignedUrl(s3Client, command, { expiresIn });
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
