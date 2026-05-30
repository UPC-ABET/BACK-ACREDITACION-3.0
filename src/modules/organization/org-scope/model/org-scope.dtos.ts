import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsPositive } from 'class-validator';
import type { I18nText } from 'src/shared/types/i18n';

export class GetScopeDto {
	@IsInt()
	@IsPositive()
	@ApiProperty({ example: 5, required: true, description: 'ID del período académico' })
	periodId: number;
}

// %% OTHER DTOS — Response documentation classes (Swagger only)
export class ScopeOptionDto {
	@ApiProperty({ example: 12 })
	id: number;

	@ApiProperty({ example: { es: 'label_es', en: 'label_en' } })
	label: I18nText;

	@ApiProperty({ example: 5, nullable: true })
	parentId: number | null;
}

export class ScopeLevelDto {
	@ApiProperty({ example: 2 })
	levelNum: number;

	@ApiProperty({ example: 'TG902-T002' })
	typeCode: string;

	@ApiProperty({ type: [ScopeOptionDto] })
	options: ScopeOptionDto[];
}

export class ScopeResponseDto {
	@ApiProperty({ example: 2, nullable: true })
	highestLevel: number | null;

	@ApiProperty({ type: [ScopeLevelDto] })
	levels: ScopeLevelDto[];
}
