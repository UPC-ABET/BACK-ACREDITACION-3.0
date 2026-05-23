import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsPositive } from 'class-validator';
import { BaseDto } from 'src/commons/base.dtos';
import type { I18nText } from 'src/shared/types/i18n';

export class GetScopeDto extends BaseDto {
	@IsInt()
	@IsPositive()
	@ApiProperty({ example: 5, required: true, description: 'ID del período académico' })
	period_id: number;
}

// %% OTHERS DTO — Response documentation classes (Swagger only)
export class ScopeOptionDto {
	@ApiProperty({ example: 12 })
	id: number;

	@ApiProperty({ example: { es: 'label_es', en: 'label_en' } })
	label: I18nText;

	@ApiProperty({ example: 5, nullable: true })
	parent_id: number | null;
}

export class ScopeLevelDto {
	@ApiProperty({ example: 2 })
	level_num: number;

	@ApiProperty({ example: 'TG902-T002' })
	type_code: string;

	@ApiProperty({ type: [ScopeOptionDto] })
	options: ScopeOptionDto[];
}

export class ScopeResponseDto {
	@ApiProperty({ example: 2, nullable: true })
	highest_level: number | null;

	@ApiProperty({ type: [ScopeLevelDto] })
	levels: ScopeLevelDto[];
}
