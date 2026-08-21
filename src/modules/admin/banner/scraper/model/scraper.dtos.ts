import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsOptional, IsString } from 'class-validator';
import type { ScrapeRunStatus, ScraperPhase } from '../../raw/model/scrape-run.entity';

// Period comes from the X-Academic-Period-Id header, not the body. These are
// optional overrides (defaults: UG, and all active programs' departments).
export class RunScrapeDto {
	@IsOptional()
	@IsString()
	@ApiPropertyOptional({ example: 'UG', description: 'Academic level. Defaults to UG.' })
	nivel?: string;

	@IsOptional()
	@IsArray()
	@ArrayNotEmpty()
	@IsString({ each: true })
	@ApiPropertyOptional({
		type: [String],
		example: ['IN', 'SI'],
		description: "Department codes to scrape. Defaults to every active program's departments.",
	})
	departamentos?: string[];
}

const SCRAPE_RUN_STATUS_VALUES = [
	'running',
	'completed',
	'partial',
	'failed',
	'expired',
] as const satisfies readonly ScrapeRunStatus[];
const SCRAPER_PHASE_VALUES = [
	'horario',
	'matricula',
	'alumnosYNotas',
] as const satisfies readonly ScraperPhase[];

export class ScrapeRunStatusResponseDto {
	@ApiProperty({ example: 'running', enum: SCRAPE_RUN_STATUS_VALUES })
	status: ScrapeRunStatus;

	@ApiPropertyOptional({
		example: 'matricula',
		enum: SCRAPER_PHASE_VALUES,
		nullable: true,
		description: 'The furthest scrape phase that has started for this run.',
	})
	phase: ScraperPhase | null;

	@ApiPropertyOptional({ type: Object, nullable: true })
	stats: unknown;
}

export class RunSummaryResponseDto {
	@ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
	runId: string;

	@ApiProperty({ example: 'UG' })
	nivel: string;

	@ApiProperty({ example: '202610' })
	periodo: string;

	@ApiProperty({ type: [String], example: ['IN', 'SI'] })
	departamentos: string[];

	@ApiProperty({ example: 'completed', enum: SCRAPE_RUN_STATUS_VALUES })
	status: ScrapeRunStatus;

	@ApiPropertyOptional({
		example: 'alumnosYNotas',
		enum: SCRAPER_PHASE_VALUES,
		nullable: true,
		description: 'The furthest scrape phase that has started for this run.',
	})
	phase: ScraperPhase | null;

	@ApiProperty({ example: '2026-08-20T10:00:00.000Z' })
	startedAt: string;

	@ApiPropertyOptional({ example: '2026-08-20T10:05:00.000Z', nullable: true, type: String })
	finishedAt: string | null;

	@ApiPropertyOptional({ type: Object, nullable: true })
	counts: unknown;

	@ApiPropertyOptional({ example: 'user:12', nullable: true, type: String })
	triggeredBy: string | null;
}
