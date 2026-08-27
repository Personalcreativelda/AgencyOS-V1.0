// Storage abstraction — local disk for dev, S3-compatible (MinIO, AWS S3, R2...) for production.
// Selected via STORAGE_TYPE env var. Swapping providers is a config change only.

import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export interface StorageProvider {
  upload(buffer: Buffer, originalName: string, mimeType: string): Promise<{ storageKey: string; publicUrl: string }>;
  remove(storageKey: string): Promise<void>;
}

class LocalStorageProvider implements StorageProvider {
  private uploadDir: string;

  constructor() {
    this.uploadDir = path.resolve(process.cwd(), process.env.STORAGE_LOCAL_PATH || './uploads');
    if (!fs.existsSync(this.uploadDir)) fs.mkdirSync(this.uploadDir, { recursive: true });
  }

  async upload(buffer: Buffer, originalName: string, _mimeType: string) {
    const ext = path.extname(originalName);
    const storageKey = `${uuidv4()}${ext}`;
    fs.writeFileSync(path.join(this.uploadDir, storageKey), buffer);

    const apiUrl = process.env.API_URL || 'http://localhost:3001';
    return { storageKey, publicUrl: `${apiUrl}/uploads/${storageKey}` };
  }

  async remove(storageKey: string) {
    const filePath = path.join(this.uploadDir, storageKey);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
}

class S3StorageProvider implements StorageProvider {
  private bucket: string;
  private publicBaseUrl: string;
  private clientPromise: Promise<import('@aws-sdk/client-s3').S3Client>;

  constructor() {
    this.bucket = process.env.S3_BUCKET || 'agencyflow-assets';
    this.publicBaseUrl = (process.env.S3_PUBLIC_URL || process.env.S3_ENDPOINT || '').replace(/\/$/, '');

    // Lazy-loaded so the dependency is only required when STORAGE_TYPE=s3 is actually used.
    this.clientPromise = import('@aws-sdk/client-s3').then(
      ({ S3Client }) =>
        new S3Client({
          endpoint: process.env.S3_ENDPOINT,
          region: process.env.S3_REGION || 'us-east-1',
          forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false', // required by MinIO
          credentials: {
            accessKeyId: process.env.S3_ACCESS_KEY || '',
            secretAccessKey: process.env.S3_SECRET_KEY || '',
          },
        })
    );
  }

  async upload(buffer: Buffer, originalName: string, mimeType: string) {
    const { PutObjectCommand } = await import('@aws-sdk/client-s3');
    const client = await this.clientPromise;

    const ext = path.extname(originalName);
    const storageKey = `${uuidv4()}${ext}`;

    await client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
        Body: buffer,
        ContentType: mimeType,
      })
    );

    return { storageKey, publicUrl: `${this.publicBaseUrl}/${this.bucket}/${storageKey}` };
  }

  async remove(storageKey: string) {
    const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
    const client = await this.clientPromise;
    await client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: storageKey }));
  }
}

let _provider: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (_provider) return _provider;
  _provider = process.env.STORAGE_TYPE === 's3' ? new S3StorageProvider() : new LocalStorageProvider();
  return _provider;
}
