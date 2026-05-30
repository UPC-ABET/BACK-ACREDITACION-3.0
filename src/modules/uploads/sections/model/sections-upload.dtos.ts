import { IsNumber, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

// Re-export de los tipos puros (sin deps) para mantener compatibilidad de imports.
export type { SectionRow, RowValidationResult, UploadResult } from './sections-upload.types';
export { STUDY_TYPE_TO_MODALITY_CODE, VALID_STUDY_TYPES } from './sections-upload.types';

// Metadatos del request de carga (el archivo viaja como multipart; estos van en el body/query).
export class SectionsUploadDto {
	@Transform(({ value }) => (value === undefined || value === null || value === '' ? undefined : Number(value)))
	@IsNumber()
	@ApiProperty({ example: 1, required: true, description: 'Periodo académico destino de la carga' })
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
