import { IsBoolean, IsNumber, IsOptional, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { BaseDto } from 'src/commons/base.dtos';

export class CreateChartDto extends BaseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	staff_id: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	academic_period_id: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	chart_level_id: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	root_chart_detail_id: number;

	@IsString()
	@Length(1, 1000)
	@ApiProperty({ example: 'level_title_example', required: true })
	level_title: string;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	entity_type_id: number;
}

export class UpdateChartDto extends BaseDto {
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
	staff_id?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	academic_period_id?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	chart_level_id?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	root_chart_detail_id?: number;

	@IsOptional()
	@IsString()
	@Length(1, 1000)
	@ApiProperty({ example: 'level_title_example', required: false })
	level_title?: string;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	entity_type_id?: number;
}

export class FilterChartDto extends BaseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	staff_id?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	academic_period_id?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	chart_level_id?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	root_chart_detail_id?: number;

	@IsOptional()
	@ApiProperty({ example: 'level_title_example', required: false })
	level_title?: string;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	entity_type_id?: number;
}
