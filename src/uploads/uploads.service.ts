import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuid } from 'uuid';

const MIME_MAX_BYTES: Record<string, number> = {
  'image/jpeg': 10 * 1024 * 1024,
  'image/png': 10 * 1024 * 1024,
  'image/webp': 10 * 1024 * 1024,
  'video/mp4': 50 * 1024 * 1024,
};

const ALLOWED_FOLDERS = new Set(['avatars', 'posts', 'reviews', 'messages']);

@Injectable()
export class UploadsService {
  private s3: S3Client;
  private bucket: string;
  private publicUrl: string;

  constructor(config: ConfigService) {
    const endpoint = config.get<string>('R2_ENDPOINT');
    this.bucket = config.get<string>('R2_BUCKET') ?? 'beancircle';
    this.publicUrl = config.get<string>('R2_PUBLIC_URL') ?? '';
    this.s3 = new S3Client({
      region: 'auto',
      endpoint,
      credentials: {
        accessKeyId: config.get<string>('R2_ACCESS_KEY_ID') ?? '',
        secretAccessKey: config.get<string>('R2_SECRET_ACCESS_KEY') ?? '',
      },
      forcePathStyle: true,
    });
  }

  presign(userId: string, contentType: string, folder = 'uploads') {
    if (!ALLOWED_FOLDERS.has(folder)) {
      throw new BadRequestException('Invalid upload folder');
    }
    const maxBytes = MIME_MAX_BYTES[contentType];
    if (!maxBytes) {
      throw new BadRequestException('Unsupported content type');
    }
    const key = `${folder}/${userId}/${uuid()}`;
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
      ContentLength: maxBytes,
    });
    const expiresIn = 600;
    const uploadUrl = getSignedUrl(this.s3, command, { expiresIn });
    return uploadUrl.then((url) => ({
      uploadUrl: url,
      publicUrl: `${this.publicUrl}/${key}`,
      key,
      expiresIn,
      maxBytes,
    }));
  }
}
