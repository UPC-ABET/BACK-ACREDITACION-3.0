import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3UploadResponseDto, S3SizeTotalResponseDto } from '../model/s3.dtos';

/**
 * S3Service.
 *
 * TODO: Integrar AWS SDK (`@aws-sdk/client-s3`) cuando se autorice instalar la dependencia.
 *  - PutObjectCommand para uploadStream
 *  - ListObjectsV2Command + paginación para getSize por prefijo
 *
 * Variables de entorno esperadas:
 *  - AWS_REGION
 *  - AWS_ACCESS_KEY_ID
 *  - AWS_SECRET_ACCESS_KEY
 *  - AWS_BUCKET_NAME
 *
 * El servicio actual valida la presencia de credenciales y devuelve
 * respuestas compatibles con el frontend antiguo sin realizar la subida
 * (modo "stub seguro") hasta que se instale el SDK.
 */
@Injectable()
export class S3Service {
	private readonly bucket: string | undefined;
	private readonly region: string | undefined;
	private readonly accessKeyId: string | undefined;
	private readonly secretAccessKey: string | undefined;

	constructor(private readonly config: ConfigService) {
		this.bucket = this.config.get<string>('AWS_BUCKET_NAME');
		this.region = this.config.get<string>('AWS_REGION');
		this.accessKeyId = this.config.get<string>('AWS_ACCESS_KEY_ID');
		this.secretAccessKey = this.config.get<string>('AWS_SECRET_ACCESS_KEY');
	}

	private ensureConfigured(): void {
		if (!this.bucket || !this.region || !this.accessKeyId || !this.secretAccessKey) {
			throw new InternalServerErrorException('AWS S3 no está configurado: faltan AWS_BUCKET_NAME / AWS_REGION / AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY en .env');
		}
	}

	async uploadStream(key: string, _file: any): Promise<S3UploadResponseDto> {
		this.ensureConfigured();

		// TODO: implementar la subida real con @aws-sdk/client-s3.
		return {
			key,
			bucket: this.bucket,
			url: `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`,
			message: 's3.upload.stub',
		};
	}

	async getSize(_prefix: string): Promise<number> {
		this.ensureConfigured();
		// TODO: implementar ListObjectsV2 paginado y sumar Size.
		return 0;
	}

	async getTotalSize(prefixes: string[]): Promise<S3SizeTotalResponseDto> {
		let totalSize = 0;
		for (const prefix of prefixes ?? []) {
			totalSize += await this.getSize(prefix);
		}
		const totalSizeInMB = totalSize / (1024 * 1024);
		return {
			totalSizeInBytes: totalSize,
			totalSizeInMB: Math.round(totalSizeInMB * 100) / 100,
			isLargerThan1GB: totalSize >= 1024 * 1024 * 1024,
		};
	}
}
