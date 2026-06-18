import { IsBoolean, IsNumber, IsOptional, IsString, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { PaginationQueryDto } from 'src/commons/pagination.dtos';
import { LookupQueryDto } from 'src/commons/lookup.dtos';

export class CreateProfessorDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extraValue' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	staffId: number;

	@IsString()
	@Length(1, 50)
	@ApiProperty({ example: 'codeExample', required: true })
	code: string;
}

export class UpdateProfessorDto {
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
	staffId?: number;

	@IsOptional()
	@IsString()
	@Length(1, 50)
	@ApiProperty({ example: 'codeExample', required: false })
	code?: string;
}

export class FilterProfessorDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extraValue' }, required: false })
	extra?: any;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	staffId?: number;

	@IsOptional()
	@IsString()
	@ApiProperty({
		example: 'searchExample',
		required: false,
		description: 'Search by professor code or staff first_name / last_name',
	})
	search?: string;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({
		example: true,
		required: false,
		description: 'When true, only professors whose staff has no linked user account',
	})
	unassigned?: boolean;

	@IsOptional()
	@ApiProperty({ example: 'codeExample', required: false })
	code?: string;
}

export class ProfessorMaintenanceQueryDto extends PaginationQueryDto {
	@IsOptional()
	@IsString()
	@ApiPropertyOptional({
		example: 'searchExample',
		description: 'Search by professor code or staff first name / last name',
	})
	search?: string;
}

export class UpdateProfessorMaintenanceDto {
	@IsOptional()
	@IsString()
	@Length(1, 50)
	@ApiPropertyOptional({ example: 'PROF-001' })
	code?: string;

	@IsOptional()
	@IsString()
	@Length(1, 255)
	@ApiPropertyOptional({ example: 'John' })
	firstName?: string;

	@IsOptional()
	@IsString()
	@Length(1, 255)
	@ApiPropertyOptional({ example: 'Doe' })
	lastName?: string;
}

export class CreateProfessorMaintenanceDto {
	@IsString()
	@Length(1, 50)
	@ApiProperty({ example: 'PROF-001' })
	code: string;

	@IsString()
	@Length(1, 255)
	@ApiProperty({ example: 'John' })
	firstName: string;

	@IsString()
	@Length(1, 255)
	@ApiProperty({ example: 'Doe' })
	lastName: string;
}

export interface ProfessorMaintenanceItem {
	id: number;
	staffId: number;
	code: string;
	firstName: string;
	lastName: string;
}

export class ProfessorLookupQueryDto extends LookupQueryDto {
	@IsOptional()
	@Transform(({ value }) => value === true || value === 'true')
	@IsBoolean()
	@ApiPropertyOptional({
		example: true,
		description: 'When true, only professors whose staff has no linked user account',
	})
	unassigned?: boolean;
}

export interface ProfessorLookupUser {
	id: number;
	firstName: string;
	lastName: string;
	email: string;
}

export interface ProfessorLookupItem {
	id: number;
	staffId: number;
	code: string | null;
	firstName: string;
	lastName: string;
	staffEmail: string | null;
	user: ProfessorLookupUser | null;
}
