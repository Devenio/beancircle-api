import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuid } from 'uuid';

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

  async presign(contentType: string, folder = 'uploads') {
    const key = `${folder}/${uuid()}`;
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });
    const uploadUrl = await getSignedUrl(this.s3, command, { expiresIn: 600 });
    const publicUrl = `${this.publicUrl}/${key}`;
    return { uploadUrl, publicUrl, key };
  }
}
