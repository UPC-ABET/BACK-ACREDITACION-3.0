import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
	AbortMultipartUploadCommand,
	CompleteMultipartUploadCommand,
	CreateMultipartUploadCommand,
	ListObjectsV2Command,
	PutObjectCommand,
	S3Client,
	UploadPartCommand,
} from '@aws-sdk/client-s3';
import { Readable } from 'stream';

const MIN_PART_SIZE = 5 * 1024 * 1024; // 5 MiB — minimum size required by S3 for intermediate parts

@Injectable()
export class S3Service {
	private readonly logger = new Logger(S3Service.name);
	private readonly s3: S3Client;
	private readonly bucket: string;

	constructor(private readonly config: ConfigService) {
		this.s3 = new S3Client({
			region: config.getOrThrow<string>('AWS_REGION'),
			credentials: {
				accessKeyId: config.getOrThrow<string>('AWS_ACCESS_KEY_ID'),
				secretAccessKey: config.getOrThrow<string>('AWS_SECRET_ACCESS_KEY'),
			},
		});
		this.bucket = config.getOrThrow<string>('AWS_BUCKET_NAME');
	}

	async uploadBuffer(key: string, buffer: Buffer, contentType = 'application/octet-stream'): Promise<void> {
		if (buffer.length < MIN_PART_SIZE) {
			await this.s3.send(
				new PutObjectCommand({
					Bucket: this.bucket,
					Key: key,
					Body: buffer,
					ContentType: contentType,
				}),
			);
			this.logger.log(`Simple PUT completed: ${key} (${buffer.length} bytes)`);
			return;
		}

		await this.multipartUploadFromBuffer(key, buffer, contentType);
	}

	async uploadStream(key: string, stream: Readable, contentType = 'application/octet-stream'): Promise<void> {
		const firstChunk = await this.readChunk(stream, MIN_PART_SIZE);

		if (firstChunk.length < MIN_PART_SIZE) {
			const remaining = await this.readAll(stream);
			const body = Buffer.concat([firstChunk, remaining]);
			await this.s3.send(
				new PutObjectCommand({
					Bucket: this.bucket,
					Key: key,
					Body: body,
					ContentType: contentType,
				}),
			);
			this.logger.log(`Simple PUT completed: ${key} (${body.length} bytes)`);
			return;
		}

		await this.multipartUploadFromStream(key, firstChunk, stream, contentType);
	}

	async getSize(prefixes: string[]): Promise<{ totalSizeInBytes: number; totalSizeInMB: number; isLargerThan1GB: boolean }> {
		let totalSize = 0;

		for (const prefix of prefixes) {
			let continuationToken: string | undefined;
			do {
				const response = await this.s3.send(
					new ListObjectsV2Command({
						Bucket: this.bucket,
						Prefix: prefix,
						ContinuationToken: continuationToken,
					}),
				);
				for (const obj of response.Contents ?? []) {
					totalSize += obj.Size ?? 0;
				}
				continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
			} while (continuationToken);
		}

		const totalSizeInMB = Math.round((totalSize / (1024 * 1024)) * 100) / 100;
		return {
			totalSizeInBytes: totalSize,
			totalSizeInMB,
			isLargerThan1GB: totalSize >= 1024 * 1024 * 1024,
		};
	}

	// ── Private helpers ───────────────────────────────────────────────────────

	private async multipartUploadFromBuffer(key: string, buffer: Buffer, contentType: string): Promise<void> {
		const { UploadId } = await this.s3.send(
			new CreateMultipartUploadCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }),
		);

		const parts: { PartNumber: number; ETag: string }[] = [];
		let partNumber = 1;

		try {
			for (let offset = 0; offset < buffer.length; offset += MIN_PART_SIZE) {
				const chunk = buffer.subarray(offset, offset + MIN_PART_SIZE);
				const result = await this.s3.send(
					new UploadPartCommand({
						Bucket: this.bucket,
						Key: key,
						UploadId,
						PartNumber: partNumber,
						Body: chunk,
					}),
				);
				parts.push({ PartNumber: partNumber++, ETag: result.ETag!.replace(/"/g, '') });
			}

			await this.s3.send(
				new CompleteMultipartUploadCommand({
					Bucket: this.bucket,
					Key: key,
					UploadId,
					MultipartUpload: { Parts: parts.sort((a, b) => a.PartNumber - b.PartNumber) },
				}),
			);

			this.logger.log(`Multipart upload completed: ${key} (${buffer.length} bytes)`);
		} catch (error) {
			await this.s3
				.send(new AbortMultipartUploadCommand({ Bucket: this.bucket, Key: key, UploadId }))
				.catch((e) => this.logger.error('Failed to abort multipart upload:', e));
			throw error;
		}
	}

	private async multipartUploadFromStream(
		key: string,
		firstChunk: Buffer,
		stream: Readable,
		contentType: string,
	): Promise<void> {
		const { UploadId } = await this.s3.send(
			new CreateMultipartUploadCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }),
		);

		const parts: { PartNumber: number; ETag: string }[] = [];
		let partNumber = 1;

		try {
			const firstResult = await this.s3.send(
				new UploadPartCommand({
					Bucket: this.bucket,
					Key: key,
					UploadId,
					PartNumber: partNumber,
					Body: firstChunk,
				}),
			);
			parts.push({ PartNumber: partNumber++, ETag: firstResult.ETag!.replace(/"/g, '') });

			let chunk: Buffer;
			while ((chunk = await this.readChunk(stream, MIN_PART_SIZE)).length > 0) {
				const result = await this.s3.send(
					new UploadPartCommand({
						Bucket: this.bucket,
						Key: key,
						UploadId,
						PartNumber: partNumber,
						Body: chunk,
					}),
				);
				parts.push({ PartNumber: partNumber++, ETag: result.ETag!.replace(/"/g, '') });
			}

			await this.s3.send(
				new CompleteMultipartUploadCommand({
					Bucket: this.bucket,
					Key: key,
					UploadId,
					MultipartUpload: { Parts: parts.sort((a, b) => a.PartNumber - b.PartNumber) },
				}),
			);

			this.logger.log(`Multipart stream upload completed: ${key}`);
		} catch (error) {
			await this.s3
				.send(new AbortMultipartUploadCommand({ Bucket: this.bucket, Key: key, UploadId }))
				.catch((e) => this.logger.error('Failed to abort multipart upload:', e));
			throw error;
		}
	}

	private readChunk(stream: Readable, size: number): Promise<Buffer> {
		return new Promise((resolve, reject) => {
			const chunks: Buffer[] = [];
			let bytesRead = 0;

			const onData = (chunk: Buffer) => {
				chunks.push(chunk);
				bytesRead += chunk.length;
				if (bytesRead >= size) {
					stream.removeListener('data', onData);
					stream.removeListener('end', onEnd);
					stream.removeListener('error', onError);
					stream.pause();
					resolve(Buffer.concat(chunks).subarray(0, size));
				}
			};

			const onEnd = () => resolve(Buffer.concat(chunks));
			const onError = (err: Error) => reject(err);

			stream.on('data', onData);
			stream.once('end', onEnd);
			stream.once('error', onError);
			stream.resume();
		});
	}

	private readAll(stream: Readable): Promise<Buffer> {
		return new Promise((resolve, reject) => {
			const chunks: Buffer[] = [];
			stream.on('data', (chunk: Buffer) => chunks.push(chunk));
			stream.once('end', () => resolve(Buffer.concat(chunks)));
			stream.once('error', reject);
		});
	}
}
