import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import type { I18nText } from 'src/shared/types/i18n';

export class GetUserSchoolsDto {
	@IsString()
	@IsNotEmpty()
	@ApiProperty({ example: 'TG102-T001', required: true, description: 'Program modality code' })
	modalityCode: string;
}

// %% OTHER DTOS — Response documentation classes (Swagger only)
export class ScopeTagDto {
	@ApiProperty({ example: 'TG903-T004' })
	code: string;

	@ApiProperty({ example: { es: 'Área', en: 'Area' }, nullable: true })
	name: I18nText | null;
}

export class ScopeOptionDto {
	@ApiProperty({ example: 1, description: 'Organization chart node id' })
	id: number;

	@ApiProperty({
		example: 1,
		nullable: true,
		description: 'Underlying entity id (e.g. program/school/course id); null for generic nodes',
	})
	entityId: number | null;

	@ApiProperty({ example: { es: 'labelEs', en: 'labelEn' } })
	label: I18nText;

	@ApiProperty({ example: 1, nullable: true })
	parentId: number | null;

	@ApiProperty({ type: ScopeTagDto, nullable: true })
	tag: ScopeTagDto | null;
}

export class ScopeLevelDto {
	@ApiProperty({
		example: 1,
		description: 'Depth below the school (1 = direct child of the school)',
	})
	levelNum: number;

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
