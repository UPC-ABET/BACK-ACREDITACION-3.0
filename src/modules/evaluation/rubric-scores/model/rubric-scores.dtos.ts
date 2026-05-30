import { IsBoolean, IsNumber, IsObject, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import type { I18nText } from 'src/shared/types/i18n';

export class CreateRubricScoreDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extraValue' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	evaluationId: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	rubricQuestionCriteriaId: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	score: number;

	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { es: 'commentariesEs', en: 'commentariesEn' }, required: false })
	commentaries?: I18nText;
}

export class UpdateRubricScoreDto {
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
	evaluationId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	rubricQuestionCriteriaId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	score?: number;

	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { es: 'commentariesEs', en: 'commentariesEn' }, required: false })
	commentaries?: I18nText;
}

export class FilterRubricScoreDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extraValue' }, required: false })
	extra?: any;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	evaluationId?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	rubricQuestionCriteriaId?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	score?: number;

	@IsOptional()
	@ApiProperty({ example: { es: 'commentariesEs', en: 'commentariesEn' }, required: false })
	commentaries?: I18nText;
}
