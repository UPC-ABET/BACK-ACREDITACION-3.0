import { ArrayNotEmpty, IsArray, IsBoolean, IsInt, IsNumber, IsOptional, IsPositive } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { BaseDto } from 'src/commons/base.dtos';

export class CreateIfcDto extends BaseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	course_id: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	academic_period_id: number;

	@IsOptional()
	@ApiProperty({ example: { key: 'information_value' }, required: false })
	information?: any;
}

export class UpdateIfcDto extends BaseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	course_id?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	academic_period_id?: number;

	@IsOptional()
	@ApiProperty({ example: { key: 'information_value' }, required: false })
	information?: any;
}

export class FilterIfcDto extends BaseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	course_id?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	academic_period_id?: number;

	@IsOptional()
	@ApiProperty({ example: { key: 'information_value' }, required: false })
	information?: any;
}

// %% OTHERS DTO

export class ListIfcsDto {
	@IsArray()
	@ArrayNotEmpty()
	@IsInt({ each: true })
	@ApiProperty({
		example: [310, 311, 312],
		required: true,
		description: 'IDs de nodos de chart (todos nivel Coordinador de Curso)',
	})
	chart_ids: number[];

	@IsInt()
	@IsPositive()
	@ApiProperty({ example: 5, required: true, description: 'ID del período académico' })
	period_id: number;
}
