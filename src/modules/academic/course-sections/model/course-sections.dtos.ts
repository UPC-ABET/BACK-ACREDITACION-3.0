import { IsBoolean, IsNumber, IsOptional, IsString, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { I18nText } from 'src/shared/types/i18n';
import { PaginationQueryDto } from 'src/commons/pagination.dtos';

export class CreateCourseSectionDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extraValue' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	courseId: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	academicPeriodId: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	campusId: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	professorId: number;

	@IsString()
	@Length(1, 50)
	@ApiProperty({ example: 'sectionCodeExample', required: true })
	sectionCode: string;

	@IsOptional()
	@ApiProperty({ example: { key: 'scheduleValue' }, required: false })
	schedule?: any;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	sectionModalityTypeId: number;
}

export class UpdateCourseSectionDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extraValue' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	courseId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	academicPeriodId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	campusId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	professorId?: number;

	@IsOptional()
	@IsString()
	@Length(1, 50)
	@ApiProperty({ example: 'sectionCodeExample', required: false })
	sectionCode?: string;

	@IsOptional()
	@ApiProperty({ example: { key: 'scheduleValue' }, required: false })
	schedule?: any;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	sectionModalityTypeId?: number;
}

export class CourseSectionMaintenanceQueryDto extends PaginationQueryDto {
	@IsOptional()
	@IsString()
	@ApiPropertyOptional({
		example: 'searchExample',
		description: 'Search by section, course, professor or campus code',
	})
	search?: string;
}

export class UpdateCourseSectionMaintenanceDto {
	@IsOptional()
	@IsString()
	@Length(1, 50)
	@ApiPropertyOptional({ example: 'SEC-01' })
	sectionCode?: string;

	@IsOptional()
	@IsNumber()
	@ApiPropertyOptional({ example: 1 })
	courseId?: number;

	@IsOptional()
	@IsNumber()
	@ApiPropertyOptional({ example: 1 })
	professorId?: number;

	@IsOptional()
	@IsNumber()
	@ApiPropertyOptional({ example: 1 })
	campusId?: number;

	@IsOptional()
	@IsNumber()
	@ApiPropertyOptional({ example: 1 })
	sectionModalityTypeId?: number;
}

export interface CourseSectionMaintenanceItem {
	id: number;
	courseCode: string;
	sectionCode: string;
	professorCode: string;
	campusCode: string;
	modalityTypeName: I18nText;
}

export class FilterCourseSectionDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extraValue' }, required: false })
	extra?: any;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	courseId?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	academicPeriodId?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	campusId?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	professorId?: number;

	@IsOptional()
	@ApiProperty({ example: 'sectionCodeExample', required: false })
	sectionCode?: string;

	@IsOptional()
	@ApiProperty({ example: { key: 'scheduleValue' }, required: false })
	schedule?: any;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	sectionModalityTypeId?: number;
}
