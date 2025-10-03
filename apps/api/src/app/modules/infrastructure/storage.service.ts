import { Inject, Injectable } from '@nestjs/common';
import {
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'node:stream';
import { APP_ENV_TOKEN, EnvVars } from '../../config';

export type UploadPart = {
  PartNumber: number;
  ETag: string;
};

@Injectable()
export class StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(@Inject(APP_ENV_TOKEN) env: EnvVars) {
    this.bucket = env.S3_BUCKET;
    this.client = new S3Client({
      region: 'us-east-1',
      endpoint: env.S3_ENDPOINT,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY,
        secretAccessKey: env.S3_SECRET_KEY,
      },
      forcePathStyle: true,
    });
  }

  async putObject(params: {
    key: string;
    body: Buffer | Uint8Array | Blob | string | Readable;
    contentType?: string;
    metadata?: Record<string, string>;
  }): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: params.key,
        Body: params.body,
        ContentType: params.contentType,
        Metadata: params.metadata,
      })
    );
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })
    );
  }

  async getObjectStream(key: string): Promise<Readable> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })
    );
    const body = response.Body;
    if (!(body instanceof Readable)) {
      throw new Error('Expected stream body from S3');
    }
    return body;
  }

  async createMultipartUpload(key: string, contentType?: string) {
    const response = await this.client.send(
      new CreateMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: contentType,
      })
    );
    return response.UploadId as string;
  }

  async uploadPart(params: {
    key: string;
    uploadId: string;
    partNumber: number;
    body: Buffer | Uint8Array | Blob | string | Readable;
  }) {
    const response = await this.client.send(
      new UploadPartCommand({
        Bucket: this.bucket,
        Key: params.key,
        UploadId: params.uploadId,
        PartNumber: params.partNumber,
        Body: params.body,
      })
    );
    return response.ETag as string;
  }

  async completeMultipartUpload(params: {
    key: string;
    uploadId: string;
    parts: UploadPart[];
  }) {
    await this.client.send(
      new CompleteMultipartUploadCommand({
        Bucket: this.bucket,
        Key: params.key,
        UploadId: params.uploadId,
        MultipartUpload: {
          Parts: params.parts,
        },
      })
    );
  }

  async getDownloadUrl(key: string, expiresIn = 600): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
      { expiresIn }
    );
  }

  async getUploadUrl(key: string, contentType?: string, expiresIn = 600) {
    return getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: contentType,
      }),
      { expiresIn }
    );
  }
}
