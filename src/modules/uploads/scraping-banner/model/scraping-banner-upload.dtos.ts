import { IsNumber, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export type { ScrapingBannerRow, RowValidationResult, UploadResult } from './scraping-banner-upload.types';

export class ScrapingBannerUploadDto {
	@Transform(({ value }) => (value === undefined || value === null || value === '' ? undefined : Number(value)))
	@IsNumber()
	@ApiProperty({ example: 1, required: true, description: 'Periodo académico destino de la carga (fallback si la fila no tiene PeriodoCodigo)' })
	academic_period_id: number;

	@IsOptional()
	@Transform(({ value }) => (value === undefined || value === null || value === '' ? undefined : Number(value)))
	@IsNumber()
	@ApiProperty({ example: 1, required: false, description: 'Usuario que ejecuta la carga' })
	user_id?: number;
}

export class RollbackUploadDto {
	@Transform(({ value }) => (value === undefined || value === null || value === '' ? undefined : Number(value)))
	@IsNumber()
	@ApiProperty({ example: 42, required: true, description: 'id de audit.upload_logs a revertir' })
	upload_log_id: number;
}
