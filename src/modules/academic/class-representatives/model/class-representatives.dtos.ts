import { IsString, IsNotEmpty, IsOptional, IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class AssignRepresentativeDto {
	@IsString()
	@IsNotEmpty()
	@ApiProperty({ example: '20231A456', description: 'Código del alumno en la tabla students' })
	studentCode: string;

	@IsString()
	@IsNotEmpty()
	@ApiProperty({
		example: 'SOFT-INT-2026-2-A',
		description: 'Código de la sección en course_sections',
	})
	sectionCode: string;
}

export class ClassRepresentativeMaintenanceQueryDto {
	@IsOptional()
	@IsString()
	@ApiProperty({
		example: 'Juan',
		required: false,
		description: 'Filtra por nombre, apellido o código del alumno, o código de sección',
	})
	search?: string;

	@IsOptional()
	@Transform(({ value }) => (value !== undefined && value !== '' ? Number(value) : undefined))
	@IsInt()
	@Min(1)
	@ApiProperty({ example: 1, required: false, description: 'Número de página' })
	page?: number;

	@IsOptional()
	@Transform(({ value }) => (value !== undefined && value !== '' ? Number(value) : undefined))
	@IsInt()
	@Min(1)
	@ApiProperty({ example: 10, required: false, description: 'Tamaño de página' })
	pageSize?: number;
}
