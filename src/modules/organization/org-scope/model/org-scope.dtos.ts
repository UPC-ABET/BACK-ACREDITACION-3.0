import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsPositive } from 'class-validator';
import type { I18nText } from 'src/shared/types/i18n';

export class GetScopeDto {
	@IsInt()
	@IsPositive()
	@ApiProperty({ example: 1, required: true, description: 'ID del período académico' })
	periodId: number;
}

// %% OTHER DTOS — Response documentation classes (Swagger only)
export class ScopeOptionDto {
	@ApiProperty({ example: 1 })
	id: number;

	@ApiProperty({ example: { es: 'labelEs', en: 'labelEn' } })
	label: I18nText;

	@ApiProperty({ example: 1, nullable: true })
	parentId: number | null;
}

export class ScopeLevelDto {
	@ApiProperty({ example: 1 })
	levelNum: number;

	@ApiProperty({ example: 'typeCodeExample' })
	typeCode: string;

	@ApiProperty({ example: {}, type: [ScopeOptionDto] })
	options: ScopeOptionDto[];
}

export class ScopeResponseDto {
	@ApiProperty({ example: 1, nullable: true })
	highestLevel: number | null;

	@ApiProperty({ example: {}, type: [ScopeLevelDto] })
	levels: ScopeLevelDto[];
}

export class UserSchoolDto {
	@ApiProperty({ example: 1 })
	id: number;

	@ApiProperty({ example: 'EISCB' })
	code: string;

	@ApiProperty({ example: { en: 'School of Software Engineering' } })
	name: I18nText;

	@ApiProperty({ example: 1 })
	facultyId: number;

	@ApiProperty({ example: 'FING', nullable: true })
	facultyCode: string | null;

	@ApiProperty({ example: { en: 'Faculty of Engineering' }, nullable: true })
	facultyName: I18nText | null;
}
