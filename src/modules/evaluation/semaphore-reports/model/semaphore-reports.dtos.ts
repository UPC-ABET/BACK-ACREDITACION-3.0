import { IsOptional, IsNumber, IsIn, IsArray, ArrayMaxSize } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class SemaphoreFilterDto {
	@Transform(({ value }) =>
		value === undefined || value === null || value === '' ? undefined : Number(value),
	)
	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false, description: 'Program commission ID to filter by' })
	programCommissionId?: number;

	@Transform(({ value }) => {
		if (value === undefined || value === null || value === '') return undefined;
		const list = Array.isArray(value) ? value : [value];
		const parsed = list.map((v) => Number(v)).filter((v) => Number.isFinite(v));
		return parsed.length > 0 ? parsed : undefined;
	})
	@IsOptional()
	@IsArray()
	@ArrayMaxSize(50)
	@IsNumber({}, { each: true })
	@ApiProperty({
		type: [Number],
		example: [1, 2],
		required: false,
		description:
			'Campus IDs to filter by. The PDF/Excel download endpoints accept at most one: omit it ' +
			'for one consolidated report over every campus, or send a single id for a report scoped ' +
			'to that campus. More than one id is rejected with 400 ' +
			'error.semaphoreReport.singleCampusRequired, since one document per campus times the ' +
			'selected outcomes is more than a single report can carry. The JSON screen endpoints ' +
			'accept any number of ids and always return one combined result.',
	})
	campusIds?: number[];

	@IsOptional()
	@IsIn(['es', 'en'])
	@ApiProperty({
		example: 'es',
		required: false,
		description: 'Language (es | en)',
		enum: ['es', 'en'],
	})
	lang?: 'es' | 'en';

	@Transform(({ value }) => {
		if (value === undefined || value === null || value === '') return undefined;
		const list = Array.isArray(value) ? value : [value];
		const parsed = list.map((v) => Number(v)).filter((v) => Number.isFinite(v));
		return parsed.length > 0 ? parsed : undefined;
	})
	@IsOptional()
	@IsArray()
	@IsNumber({}, { each: true })
	@ApiProperty({
		type: [Number],
		example: [1, 2],
		required: false,
		description:
			'RV only: rubric IDs to include. Omit for all rubrics. Deprecated: prefer gradeTypeIds.',
	})
	rubricIds?: number[];

	@Transform(({ value }) => {
		if (value === undefined || value === null || value === '') return undefined;
		const list = Array.isArray(value) ? value : [value];
		const parsed = list.map((v) => Number(v)).filter((v) => Number.isFinite(v));
		return parsed.length > 0 ? parsed : undefined;
	})
	@IsOptional()
	@IsArray()
	@IsNumber({}, { each: true })
	@ApiProperty({
		type: [Number],
		example: [1, 2],
		required: false,
		description:
			'RV only: grade type IDs (tipo de nota, core.types group TG205) to include. Filters RV grades by their rubric grade type. Omit for all.',
	})
	gradeTypeIds?: number[];
}

export class SemaphoreLevelLegendDto {
	name: string;
	minScore: number;
	maxScore: number;
	color: string;
}

export class SemaphoreCourseOutcomeSummaryDto {
	campus: string;
	academicPeriodCycle: string;
	courseCode: string;
	courseName: string;
	outcomeCode: string;
	outcomeName: string;
	totalStudents: number;
	studentsRed: number;
	studentsYellow: number;
	studentsGreen: number;
	percentageRed: number;
	percentageYellow: number;
	percentageGreen: number;
	isCritical: boolean;
	color: string;
}

export class SemaphoreReportDto {
	legend: SemaphoreLevelLegendDto[];
	summary: SemaphoreCourseOutcomeSummaryDto[];
	metadata: SemaphoreMetadataDto;
}

/** One row of RC's "Resumen por Outcome" table -- critical outcomes only, one row per
 *  (campus, outcome, level), rendered with that level's colour. */
export class SemaphoreOutcomeSummaryRowDto {
	campus: string;
	outcomeCode: string;
	outcomeName: string;
	totalStudents: number;
	levelName: string;
	count: number;
	percentage: number;
	color: string;
}

export class SemaphoreOutcomeLevelCellDto {
	name: string;
	color: string;
	count: number;
	percentage: number;
}

export class SemaphoreOutcomePivotRowDto {
	outcomeCode: string;
	outcomeName: string;
	outcomeDescription: string;
	totalStudents: number;
	levels: SemaphoreOutcomeLevelCellDto[];
}

export class SemaphoreCourseDetailRowDto {
	campus: string;
	outcomeCode: string;
	outcomeName: string;
	courseCode: string;
	courseName: string;
	count: number;
	totalStudents: number;
	percentage: number;
}

/** One level's cell in the consolidated RC table -- rendered as `(count) percentage%`. */
export class SemaphoreConsolidatedCellDto {
	count: number;
	percentage: number;
}

export class SemaphoreConsolidatedRowDto {
	courseCode: string;
	courseName: string;
	/** One entry per performance level, ascending -- same order as `legend`. */
	levels: SemaphoreConsolidatedCellDto[];
	totalStudents: number;
}

/** The consolidated RC table, split into one block per outcome so each can close with a
 *  TOTALES row. */
export class SemaphoreConsolidatedGroupDto {
	outcomeCode: string;
	outcomeName: string;
	rows: SemaphoreConsolidatedRowDto[];
	levelTotals: number[];
	totalStudents: number;
}

export class SemaphoreMetadataDto {
	programName: string;
	modalityName: string;
	commissionName: string;
	academicPeriodCode: string;
	accreditorCode: string;
}
