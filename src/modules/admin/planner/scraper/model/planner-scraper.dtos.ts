import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsOptional, IsString } from 'class-validator';
import type {
	PlannerScrapeRunStatus,
	PlannerScraperPhase,
} from '../../raw/model/planner-scrape-run.entity';

// Derived from the union types (via `satisfies`) so an added/renamed status or phase value
// without a matching update here is a compile error, not a silently stale Swagger `enum`.
const PLANNER_SCRAPE_RUN_STATUS_VALUES = [
	'running',
	'completed',
	'partial',
	'failed',
	'expired',
] as const satisfies readonly PlannerScrapeRunStatus[];

const PLANNER_SCRAPER_PHASE_VALUES = [
	'secciones',
	'evaluaciones',
	'notas',
] as const satisfies readonly PlannerScraperPhase[];

// Period comes from the X-Academic-Period-Id header, not the body. These are optional
// overrides (defaults: nivel UG, and all active course codes for the sections search).
export class RunPlannerScrapeDto {
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
		example: ['CS101', 'CS102'],
		description: 'Course codes to scrape. Defaults to every active course code.',
	})
	cursos?: string[];
}

export class PlannerScrapeRunStatusResponseDto {
	@ApiProperty({
		enum: PLANNER_SCRAPE_RUN_STATUS_VALUES,
		description: 'Terminal status of the run.',
	})
	status: PlannerScrapeRunStatus;

	@ApiPropertyOptional({
		enum: PLANNER_SCRAPER_PHASE_VALUES,
		nullable: true,
		description:
			'The furthest phase that has started for this run. Null until the first phase begins.',
	})
	phase: PlannerScraperPhase | null;

	@ApiPropertyOptional({ type: Object, nullable: true, description: 'Per-run scrape stats.' })
	stats: unknown;
}

export class PlannerRunSummaryResponseDto {
	@ApiProperty({ description: 'Scrape run id (uuid).' })
	runId: string;

	@ApiProperty({ description: 'Banner/Planner periodo code.' })
	periodo: string;

	@ApiPropertyOptional({ type: String, nullable: true, description: 'Escuela code, if scoped.' })
	escuela: string | null;

	@ApiProperty({
		enum: PLANNER_SCRAPE_RUN_STATUS_VALUES,
		description: 'Terminal status of the run.',
	})
	status: PlannerScrapeRunStatus;

	@ApiPropertyOptional({
		enum: PLANNER_SCRAPER_PHASE_VALUES,
		nullable: true,
		description:
			'The furthest phase that has started for this run. Null until the first phase begins.',
	})
	phase: PlannerScraperPhase | null;

	@ApiProperty({ description: 'ISO timestamp the run started.' })
	startedAt: string;

	@ApiPropertyOptional({
		type: String,
		nullable: true,
		description: 'ISO timestamp the run finished.',
	})
	finishedAt: string | null;

	@ApiPropertyOptional({
		type: Object,
		nullable: true,
		description: 'Per-stage counts once the run has produced any.',
	})
	counts: unknown;

	@ApiPropertyOptional({ type: String, nullable: true, description: 'Who triggered the run.' })
	triggeredBy: string | null;
}
