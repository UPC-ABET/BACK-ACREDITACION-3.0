import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from 'src/commons/pagination.dtos';

export class AssignRepresentativeDto {
	@IsString()
	@IsNotEmpty()
	@ApiProperty({ example: '20231A456', description: 'Student code in the students table' })
	studentCode: string;

	@IsString()
	@IsNotEmpty()
	@ApiProperty({ example: 'SOFT-INT-2026-2-A', description: 'Section code in course_sections' })
	sectionCode: string;
}

export class ClassRepresentativeMaintenanceQueryDto extends PaginationQueryDto {
	@IsOptional()
	@IsString()
	@ApiPropertyOptional({
		example: 'Juan',
		description: 'Filter by student name, student code, or section code',
	})
	search?: string;
}
