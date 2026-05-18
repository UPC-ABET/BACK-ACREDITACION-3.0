import { IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, ValidateNested, Length } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { BaseDto } from 'src/commons/base.dtos';
import { ProjectPortfolioStatus } from './project-portfolios.entity';

// %% =====================================================================
// %%  PAGINATION HELPER
// %% =====================================================================
export class PageDto {
	@IsOptional()
	@IsInt()
	@ApiProperty({ example: 1, required: false, description: '-1 para devolver todo' })
	pageNumber?: number = 1;

	@IsOptional()
	@IsInt()
	@ApiProperty({ example: 10, required: false, description: '-1 para devolver todo' })
	pageSize?: number = 10;
}

// %% =====================================================================
// %%  CREATE
// %% =====================================================================
/**
 * Compatible con el ProjectPortfolioDTO del .NET (camelCase español).
 * También se aceptan nombres normalizados modernos.
 */
export class CreateProjectPortfolioDto extends BaseDto {
	@IsOptional()
	@IsString()
	@ApiProperty({ required: false })
	code?: string;

	@IsString()
	@Length(1, 1000)
	@ApiProperty()
	name: string;

	@IsOptional()
	@IsString()
	@ApiProperty({ required: false })
	description?: string;

	@IsOptional()
	@IsString()
	@ApiProperty({ required: false })
	problemSolved?: string;

	@IsOptional()
	@IsString()
	@ApiProperty({ required: false })
	goal?: string;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ required: false })
	isFromUPC?: boolean;

	// formato antiguo (es)
	@IsOptional()
	@IsInt()
	@ApiProperty({ required: false })
	periodoAcademicoId?: number;

	@IsOptional()
	@IsInt()
	@ApiProperty({ required: false })
	idModalidad?: number;

	@IsOptional()
	@IsInt()
	@ApiProperty({ required: false })
	idEmpresa?: number;

	@IsOptional()
	@IsString()
	@ApiProperty({ required: false })
	codigoEmpresa?: string;

	@IsOptional()
	@IsInt()
	@ApiProperty({ required: false })
	idCarrera?: number;

	// formato moderno (en) — opcional
	@IsOptional()
	@IsInt()
	@ApiProperty({ required: false })
	academicPeriodId?: number;

	@IsOptional()
	@IsInt()
	@ApiProperty({ required: false })
	modalityId?: number;

	@IsOptional()
	@IsInt()
	@ApiProperty({ required: false })
	companyId?: number;

	@IsOptional()
	@IsString()
	@ApiProperty({ required: false })
	companyCode?: string;

	@IsOptional()
	@IsInt()
	@ApiProperty({ required: false })
	careerId?: number;

	// estudiantes
	@IsOptional()
	@IsInt()
	@ApiProperty({ required: false })
	studentOneId?: number;

	@IsOptional()
	@IsInt()
	@ApiProperty({ required: false })
	studentTwoId?: number;

	@IsOptional()
	@IsInt()
	@ApiProperty({ required: false })
	courseId?: number;

	@IsOptional()
	@IsInt()
	@ApiProperty({ required: false })
	researchLineId?: number;

	@IsOptional()
	@IsInt()
	@ApiProperty({ required: false })
	coautorId?: number;

	@IsOptional()
	@IsInt()
	@ApiProperty({ required: false })
	consultantId?: number;
}

// %% =====================================================================
// %%  UPDATE
// %% =====================================================================
export class UpdateProjectPortfolioDto extends BaseDto {
	@IsOptional()
	@IsInt()
	@ApiProperty({ required: false })
	projectId?: number;

	@IsOptional()
	@IsString()
	@ApiProperty({ required: false })
	code?: string;

	@IsOptional()
	@IsString()
	@ApiProperty({ required: false })
	name?: string;

	@IsOptional()
	@IsString()
	@ApiProperty({ required: false })
	description?: string;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ required: false })
	isFromUPC?: boolean;

	@IsOptional()
	@IsString()
	@ApiProperty({ required: false })
	studentCodeOne?: string;

	@IsOptional()
	@IsInt()
	@ApiProperty({ required: false })
	studentOneId?: number;

	@IsOptional()
	@IsString()
	@ApiProperty({ required: false })
	studentCodeTwo?: string;

	@IsOptional()
	@IsInt()
	@ApiProperty({ required: false })
	studentTwoId?: number;

	@IsOptional()
	@IsEnum(ProjectPortfolioStatus)
	@ApiProperty({ enum: ProjectPortfolioStatus, required: false })
	status?: ProjectPortfolioStatus;

	@IsOptional()
	@IsInt()
	@ApiProperty({ required: false })
	idPeriodoAcademico?: number;

	@IsOptional()
	@IsInt()
	@ApiProperty({ required: false })
	idModalidad?: number;

	@IsOptional()
	@IsInt()
	@ApiProperty({ required: false })
	idEmpresa?: number;

	@IsOptional()
	@IsString()
	@ApiProperty({ required: false })
	codigoEmpresa?: string;

	@IsOptional()
	@IsInt()
	@ApiProperty({ required: false })
	idCarrera?: number;

	@IsOptional()
	@IsString()
	@ApiProperty({ required: false })
	problemSolved?: string;

	@IsOptional()
	@IsString()
	@ApiProperty({ required: false })
	goal?: string;

	@IsOptional()
	@IsInt()
	@ApiProperty({ required: false })
	researchLineId?: number;

	@IsOptional()
	@IsInt()
	@ApiProperty({ required: false })
	coautorId?: number;

	@IsOptional()
	@IsInt()
	@ApiProperty({ required: false })
	consultantId?: number;
}

// %% =====================================================================
// %%  UPDATE MANAGER
// %% =====================================================================
export class UpdateProjectPortfolioManagerDto extends BaseDto {
	@IsInt()
	@ApiProperty()
	projectId: number;

	@IsString()
	@ApiProperty()
	name: string;

	@IsOptional()
	@IsString()
	@ApiProperty({ required: false })
	description?: string;

	@IsOptional()
	@IsInt()
	@ApiProperty({ required: false })
	studentOneId?: number;

	@IsOptional()
	@IsInt()
	@ApiProperty({ required: false })
	studentTwoId?: number;

	@IsString()
	@ApiProperty()
	problemSolved: string;

	@IsString()
	@ApiProperty()
	goal: string;

	@IsOptional()
	@IsInt()
	@ApiProperty({ required: false })
	coautorId?: number;

	@IsOptional()
	@IsInt()
	@ApiProperty({ required: false })
	consultantId?: number;
}

// %% =====================================================================
// %%  FILTER
// %% =====================================================================
export class FilterProjectPortfolioDto extends BaseDto {
	@IsOptional()
	@IsString()
	@ApiProperty({ required: false })
	college?: string;

	@IsOptional()
	@IsInt()
	@ApiProperty({ required: false })
	periodoAcademicoId?: number;

	@IsOptional()
	@IsInt()
	@ApiProperty({ required: false })
	careerId?: number;

	@IsOptional()
	@IsEnum(ProjectPortfolioStatus)
	@ApiProperty({ enum: ProjectPortfolioStatus, required: false })
	status?: ProjectPortfolioStatus;

	@IsOptional()
	@IsString()
	@ApiProperty({ required: false })
	studentCode?: string;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ required: false })
	isFromUPC?: boolean;

	@IsOptional()
	@IsInt()
	@ApiProperty({ required: false })
	idModality?: number;

	@IsOptional()
	@IsArray()
	@ApiProperty({ required: false, type: [Number] })
	careersIds?: number[];

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ required: false })
	assignment?: boolean;

	@IsOptional()
	@IsString()
	@ApiProperty({ required: false })
	courseCode?: string;

	@IsOptional()
	@IsString()
	@ApiProperty({ required: false })
	sectionCode?: string;

	@IsOptional()
	@IsString()
	@ApiProperty({ required: false })
	teacherCode?: string;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ required: false })
	evaluatorInfo?: boolean;
}

// %% =====================================================================
// %%  PAGINATED REQUEST
// %% =====================================================================
export class PaginatedProjectPortfolioRequestDto extends BaseDto {
	@ValidateNested()
	@Type(() => FilterProjectPortfolioDto)
	@ApiProperty({ type: FilterProjectPortfolioDto })
	body: FilterProjectPortfolioDto;

	@ValidateNested()
	@Type(() => PageDto)
	@ApiProperty({ type: PageDto })
	page: PageDto;
}

// %% =====================================================================
// %%  MIGRATE
// %% =====================================================================
export class MigrateProjectPortfoliosDto extends BaseDto {
	@IsString()
	@ApiProperty()
	courseCode: string;

	@IsString()
	@ApiProperty()
	newCourseCode: string;

	@IsInt()
	@ApiProperty()
	newAcademicPeriodId: number;

	@IsInt()
	@ApiProperty()
	modalityId: number;
}

export class MigrateFromDatabaseDto extends BaseDto {
	@IsString()
	@ApiProperty()
	originCourseCode: string;

	@IsString()
	@ApiProperty()
	finalCourseCode: string;

	@IsInt()
	@ApiProperty()
	periodoAcademicoId: number;

	@IsInt()
	@ApiProperty()
	modalityId: number;
}

// %% =====================================================================
// %%  AUTO ASSIGN PARTNER
// %% =====================================================================
export class AutoAssignPartnerDto extends BaseDto {
	@IsInt()
	@ApiProperty()
	modalityId: number;

	@IsString()
	@ApiProperty()
	courseCode: string;
}

// %% =====================================================================
// %%  MANAGEMENT ASSIGN
// %% =====================================================================
export class ManagementAssignDto extends BaseDto {
	@IsString()
	@ApiProperty()
	courseCode: string;

	@IsInt()
	@ApiProperty()
	projectId: number;

	@IsOptional()
	@IsInt()
	@ApiProperty({ required: false })
	studentOneId?: number;

	@IsOptional()
	@IsInt()
	@ApiProperty({ required: false })
	studentTwoId?: number;
}

// %% =====================================================================
// %%  BULK UPLOAD / EXPORT
// %% =====================================================================
export class BulkUploadProjectPortfolioDto extends BaseDto {
	@ApiProperty({ type: 'string', format: 'binary' })
	file: any;
}

export class ExportProjectPortfolioDto extends PaginatedProjectPortfolioRequestDto {}

// %% =====================================================================
// %%  RESPONSE
// %% =====================================================================
export class ProjectPortfolioResponseDto {
	projectId: number;
	code: string;
	name: string;
	description?: string;
	problemSolved?: string;
	goal?: string;
	isFromUPC: boolean;
	status: string;
	idPeriodoAcademico: number;
	idModalidad: number;
	idEmpresa?: number;
	codigoEmpresa?: string;
	idCarrera: number;
	courseId?: number;
	researchLineId?: number;
	studentOneId?: number;
	studentTwoId?: number;
	coautorId?: number;
	consultantId?: number;
	activeEnrollmentStudentOneId?: number;
	activeEnrollmentStudentTwoId?: number;
}
