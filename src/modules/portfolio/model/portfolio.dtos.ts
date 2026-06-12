import {
	IsBoolean,
	IsEnum,
	IsInt,
	IsOptional,
	IsString,
	IsArray,
	Min,
	MaxLength,
	IsPositive,
	ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { PortfolioStatus } from '../enums/portfolio-status.enum';

// ── Pagination ────────────────────────────────────────────────────────────────

export class PageDto {
	@ApiProperty({ example: 1 })
	@IsInt()
	@Min(1)
	pageNumber: number;

	@ApiProperty({ example: 20 })
	@IsInt()
	@IsPositive()
	pageSize: number;
}

export class PaginationResultDto<T> {
	totalCount: number;
	pageNumber: number;
	pageSize: number;
	data: T[];
}

// ── Create ────────────────────────────────────────────────────────────────────

export class CreatePortfolioProjectDto {
	@ApiProperty({ maxLength: 255 })
	@IsString()
	@MaxLength(255)
	name: string;

	@ApiProperty({ maxLength: 5000 })
	@IsString()
	@MaxLength(5000)
	description: string;

	@ApiProperty()
	@IsInt()
	@IsPositive()
	academicPeriodId: number;

	@ApiProperty({ description: 'Type ID for modality (references core.types)' })
	@IsInt()
	@IsPositive()
	modalityTypeId: number;

	@ApiProperty()
	@IsBoolean()
	isFromUPC: boolean;

	@ApiPropertyOptional({ description: 'Company ID (required if companyCode not provided)' })
	@IsOptional()
	@IsInt()
	@IsPositive()
	companyId?: number;

	@ApiPropertyOptional({ description: 'Company code (used when companyId not provided)' })
	@IsOptional()
	@IsString()
	companyCode?: string;

	@ApiProperty({ description: 'Program (carrera) ID' })
	@IsInt()
	@IsPositive()
	programId: number;

	@ApiPropertyOptional()
	@IsOptional()
	@IsInt()
	@IsPositive()
	studentOneId?: number;

	@ApiPropertyOptional()
	@IsOptional()
	@IsInt()
	@IsPositive()
	studentTwoId?: number;

	@ApiPropertyOptional()
	@IsOptional()
	@IsInt()
	@IsPositive()
	courseSectionId?: number;
}

// ── Update ────────────────────────────────────────────────────────────────────

export class UpdatePortfolioProjectDto {
	@ApiPropertyOptional({ maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	name?: string;

	@ApiPropertyOptional({ maxLength: 5000 })
	@IsOptional()
	@IsString()
	@MaxLength(5000)
	description?: string;

	@ApiPropertyOptional({ maxLength: 5000 })
	@IsOptional()
	@IsString()
	@MaxLength(5000)
	problemSolved?: string;

	@ApiPropertyOptional({ maxLength: 5000 })
	@IsOptional()
	@IsString()
	@MaxLength(5000)
	goal?: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsBoolean()
	isFromUPC?: boolean;

	@ApiPropertyOptional({ enum: PortfolioStatus })
	@IsOptional()
	@IsEnum(PortfolioStatus)
	status?: PortfolioStatus;

	@ApiPropertyOptional()
	@IsOptional()
	@IsInt()
	studentOneId?: number | null;

	@ApiPropertyOptional()
	@IsOptional()
	@IsInt()
	studentTwoId?: number | null;

	@ApiPropertyOptional()
	@IsOptional()
	@IsInt()
	@IsPositive()
	academicPeriodId?: number;

	@ApiPropertyOptional()
	@IsOptional()
	@IsInt()
	@IsPositive()
	modalityTypeId?: number;

	@ApiPropertyOptional()
	@IsOptional()
	@IsInt()
	@IsPositive()
	companyId?: number;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	companyCode?: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsInt()
	@IsPositive()
	programId?: number;

	@ApiPropertyOptional()
	@IsOptional()
	@IsInt()
	@IsPositive()
	researchLineId?: number;

	@ApiPropertyOptional()
	@IsOptional()
	@IsInt()
	coauthorProfessorId?: number | null;

	@ApiPropertyOptional()
	@IsOptional()
	@IsInt()
	consultantProfessorId?: number | null;

	@ApiPropertyOptional()
	@IsOptional()
	@IsInt()
	@IsPositive()
	courseSectionId?: number;
}

// ── Update Manager ────────────────────────────────────────────────────────────

export class UpdatePortfolioManagerDto {
	@ApiProperty()
	@IsString()
	@MaxLength(255)
	name: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	@MaxLength(5000)
	description?: string;

	@ApiProperty()
	@IsString()
	@MaxLength(5000)
	problemSolved: string;

	@ApiProperty()
	@IsString()
	@MaxLength(5000)
	goal: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsInt()
	studentOneId?: number | null;

	@ApiPropertyOptional()
	@IsOptional()
	@IsInt()
	studentTwoId?: number | null;

	@ApiPropertyOptional()
	@IsOptional()
	@IsInt()
	coauthorProfessorId?: number | null;

	@ApiPropertyOptional()
	@IsOptional()
	@IsInt()
	consultantProfessorId?: number | null;
}

// ── Filters ───────────────────────────────────────────────────────────────────

export class FilterPortfolioProjectDto {
	@ApiPropertyOptional()
	@IsOptional()
	@IsInt()
	@IsPositive()
	academicPeriodId?: number;

	@ApiPropertyOptional()
	@IsOptional()
	@IsInt()
	@IsPositive()
	programId?: number;

	@ApiPropertyOptional({ isArray: true, type: Number })
	@IsOptional()
	@IsArray()
	@IsInt({ each: true })
	programIds?: number[];

	@ApiPropertyOptional({ enum: PortfolioStatus })
	@IsOptional()
	@IsEnum(PortfolioStatus)
	status?: PortfolioStatus;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	studentCode?: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsBoolean()
	isFromUPC?: boolean;

	@ApiPropertyOptional()
	@IsOptional()
	@IsInt()
	@IsPositive()
	modalityTypeId?: number;

	@ApiPropertyOptional({
		description: 'true = projects without students (with applicants), false = with students',
	})
	@IsOptional()
	@IsBoolean()
	assignment?: boolean;

	@ApiPropertyOptional()
	@IsOptional()
	@IsInt()
	@IsPositive()
	courseSectionId?: number;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	teacherCode?: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsInt()
	@IsPositive()
	schoolId?: number;
}

export class GetAllPortfolioDto {
	@ApiProperty({ type: PageDto })
	@ValidateNested()
	@Type(() => PageDto)
	page: PageDto;

	@ApiProperty({ type: FilterPortfolioProjectDto })
	@ValidateNested()
	@Type(() => FilterPortfolioProjectDto)
	body: FilterPortfolioProjectDto;
}

// ── Auto-assign partner ───────────────────────────────────────────────────────

export class AutoAssignPartnerDto {
	@ApiProperty()
	@IsInt()
	@IsPositive()
	modalityTypeId: number;

	@ApiProperty()
	@IsInt()
	@IsPositive()
	courseSectionId: number;
}

// ── Management assign ─────────────────────────────────────────────────────────

export class ManagementAssignDto {
	@ApiProperty()
	@IsInt()
	@IsPositive()
	projectId: number;

	@ApiProperty()
	@IsInt()
	@IsPositive()
	studentOneId: number;

	@ApiPropertyOptional()
	@IsOptional()
	@IsInt()
	@IsPositive()
	studentTwoId?: number;

	@ApiPropertyOptional()
	@IsOptional()
	@IsInt()
	@IsPositive()
	courseSectionId?: number;
}

// ── Migrate projects ──────────────────────────────────────────────────────────

export class MigratePortfolioProjectsDto {
	@ApiProperty({ description: 'Origin course section ID' })
	@IsInt()
	@IsPositive()
	originCourseSectionId: number;

	@ApiProperty({ description: 'Destination course section ID' })
	@IsInt()
	@IsPositive()
	destinationCourseSectionId: number;

	@ApiProperty({ description: 'New academic period ID' })
	@IsInt()
	@IsPositive()
	newAcademicPeriodId: number;

	@ApiProperty()
	@IsInt()
	@IsPositive()
	modalityTypeId: number;
}

// ── Company ───────────────────────────────────────────────────────────────────

export class CreateCompanyDto {
	@ApiProperty()
	@IsString()
	@MaxLength(255)
	name: string;

	@ApiProperty()
	@IsString()
	@MaxLength(50)
	code: string;

	@ApiProperty()
	@IsBoolean()
	isFromUPC: boolean;

	@ApiProperty()
	@IsInt()
	@IsPositive()
	academicPeriodId: number;

	@ApiProperty()
	@IsInt()
	@IsPositive()
	modalityTypeId: number;
}

// ── Research line ─────────────────────────────────────────────────────────────

export class CreateResearchLineDto {
	@ApiProperty()
	@IsString()
	@MaxLength(255)
	name: string;

	@ApiProperty()
	@IsInt()
	@IsPositive()
	programId: number;

	@ApiProperty()
	@IsInt()
	@IsPositive()
	modalityTypeId: number;
}
