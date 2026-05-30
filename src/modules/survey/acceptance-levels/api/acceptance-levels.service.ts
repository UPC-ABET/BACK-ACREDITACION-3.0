import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AcceptanceLevelRepository } from '../core/acceptance-levels.repository';
import {
	FilterAcceptanceLevelDto,
	BulkUpdateAcceptanceLevelsDto,
	GenerateDefaultAcceptanceLevelsDto,
	CopyAcceptanceLevelsDto,
} from '../model/acceptance-levels.dtos';

const DEFAULT_LEVELS = [
	{
		order: 1,
		name: { es: 'Deficiente', en: 'Deficient' },
		minScore: 1.0,
		maxScore: 1.8,
		color: '#E53E3E',
		isFinal: false,
	},
	{
		order: 2,
		name: { es: 'Insuficiente', en: 'Insufficient' },
		minScore: 1.8,
		maxScore: 2.6,
		color: '#ED8936',
		isFinal: false,
	},
	{
		order: 3,
		name: { es: 'Satisfactorio', en: 'Satisfactory' },
		minScore: 2.6,
		maxScore: 3.4,
		color: '#ECC94B',
		isFinal: false,
	},
	{
		order: 4,
		name: { es: 'Competente', en: 'Competent' },
		minScore: 3.4,
		maxScore: 4.2,
		color: '#68D391',
		isFinal: false,
	},
	{
		order: 5,
		name: { es: 'Excelente', en: 'Excellent' },
		minScore: 4.2,
		maxScore: 5.0,
		color: '#276749',
		isFinal: true,
	},
];

@Injectable()
export class AcceptanceLevelService {
	constructor(private readonly repository: AcceptanceLevelRepository) {}

	async list(dto: FilterAcceptanceLevelDto) {
		let { surveyTypeId } = dto;

		if (!surveyTypeId && dto.surveyTypeCode) {
			const resolved = await this.repository.findSurveyTypeIdByCode(dto.surveyTypeCode);
			if (!resolved)
				throw new NotFoundException(
					`Tipo de encuesta con código "${dto.surveyTypeCode}" no encontrado`,
				);
			surveyTypeId = resolved;
		}

		if (!surveyTypeId)
			throw new BadRequestException('Se requiere survey_type_id o survey_type_code');

		const count = await this.repository.countBySurveyTypeAndPeriod(
			surveyTypeId,
			dto.academicPeriodId,
		);

		if (count === 0) {
			await this.createDefaults(surveyTypeId, dto.academicPeriodId);
		}

		return await this.repository.findBySurveyTypeAndPeriod(surveyTypeId, dto.academicPeriodId);
	}

	async bulkUpdate(dto: BulkUpdateAcceptanceLevelsDto) {
		const results: { id: number; updated: boolean }[] = [];

		for (const item of dto.items) {
			const payload: Record<string, any> = {};
			if (item.name !== undefined) payload.name = item.name;
			if (item.minScore !== undefined) payload.minScore = item.minScore;
			if (item.maxScore !== undefined) payload.maxScore = item.maxScore;
			if (item.color !== undefined) payload.color = item.color;
			if (item.order !== undefined) payload.order = item.order;
			if (item.isFinal !== undefined) payload.isFinal = item.isFinal;

			if (Object.keys(payload).length > 0) {
				await this.repository.update(item.id, payload);
				results.push({ id: item.id, updated: true });
			} else {
				results.push({ id: item.id, updated: false });
			}
		}

		return { updated: results.filter((r) => r.updated).length, total: dto.items.length };
	}

	async generateDefaults(dto: GenerateDefaultAcceptanceLevelsDto) {
		const existing = await this.repository.countBySurveyTypeAndPeriod(
			dto.surveyTypeId,
			dto.academicPeriodId,
		);
		if (existing > 0)
			throw new BadRequestException(
				'Ya existen niveles de aceptación para este tipo de encuesta y período',
			);
		await this.createDefaults(dto.surveyTypeId, dto.academicPeriodId);
		return await this.repository.findBySurveyTypeAndPeriod(dto.surveyTypeId, dto.academicPeriodId);
	}

	async copyFromPeriod(dto: CopyAcceptanceLevelsDto): Promise<number> {
		const source = await this.repository.findBySurveyTypeAndPeriod(
			dto.surveyTypeId,
			dto.sourceAcademicPeriodId,
		);

		if (source.length === 0) {
			await this.createDefaults(dto.surveyTypeId, dto.targetAcademicPeriodId);
			return DEFAULT_LEVELS.length;
		}

		const targetCount = await this.repository.countBySurveyTypeAndPeriod(
			dto.surveyTypeId,
			dto.targetAcademicPeriodId,
		);
		if (targetCount > 0) return 0;

		for (const level of source) {
			await this.repository.create({
				surveyTypeId: dto.surveyTypeId,
				academicPeriodId: dto.targetAcademicPeriodId,
				name: level.name,
				order: level.order,
				minScore: level.minScore,
				maxScore: level.maxScore,
				color: level.color,
				isFinal: level.isFinal,
				isActive: true,
			});
		}

		return source.length;
	}

	private async createDefaults(surveyTypeId: number, academicPeriodId: number): Promise<void> {
		for (const level of DEFAULT_LEVELS) {
			await this.repository.create({
				surveyTypeId,
				academicPeriodId,
				name: level.name,
				order: level.order,
				minScore: level.minScore,
				maxScore: level.maxScore,
				color: level.color,
				isFinal: level.isFinal,
				isActive: true,
			});
		}
	}
}
