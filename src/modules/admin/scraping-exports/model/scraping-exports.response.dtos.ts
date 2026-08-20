// Swagger-only response shape for the `status`/`regenerate` endpoints. `ScrapingExportStatusResponse`
// (scraping-exports.types.ts) is a plain interface, so it carries no decorators the Swagger plugin can
// read; this class mirrors its field set by hand so those two routes document a real 200 schema instead
// of an empty one. Controllers keep returning the interface value as-is -- nothing here is constructed
// at runtime.
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Mirrors `ScrapingExportType`.
const SCRAPING_EXPORT_TYPE_VALUES = [
	'staff',
	'sections',
	'enrolledStudents',
	'studentSections',
	'gradesRc',
] as const;

// Mirrors `ScrapingExportGenerationStatus | 'notGenerated'`.
const SCRAPING_EXPORT_STATUS_VALUES = ['running', 'completed', 'failed', 'notGenerated'] as const;

// `getStatus` returns bare `{ status: 'notGenerated' }` when no row exists yet for the key, so every
// field but `status` is optional here.
export class ScrapingExportStatusResponseDto {
	@ApiPropertyOptional({ enum: SCRAPING_EXPORT_TYPE_VALUES })
	exportType?: string;

	@ApiPropertyOptional()
	periodo?: string;

	@ApiPropertyOptional()
	lang?: string;

	@ApiProperty({ enum: SCRAPING_EXPORT_STATUS_VALUES })
	status: string;

	@ApiPropertyOptional({ nullable: true, type: String })
	fileName?: string | null;

	@ApiPropertyOptional({ nullable: true, type: String })
	errorMessage?: string | null;

	@ApiPropertyOptional({ nullable: true, type: Date })
	startedAt?: Date | null;

	@ApiPropertyOptional({ nullable: true, type: Date })
	finishedAt?: Date | null;
}
