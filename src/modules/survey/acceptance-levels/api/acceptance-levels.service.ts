import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AcceptanceLevelRepository } from '../core/acceptance-levels.repository';
import { FilterAcceptanceLevelDto, BulkUpdateAcceptanceLevelsDto, GenerateDefaultAcceptanceLevelsDto, CopyAcceptanceLevelsDto } from '../model/acceptance-levels.dtos';

const DEFAULT_LEVELS = [
	{ order: 1, name: { es: 'Deficiente', en: 'Deficient' }, min_score: 1.0, max_score: 1.8, color: '#E53E3E', is_final: false },
	{ order: 2, name: { es: 'Insuficiente', en: 'Insufficient' }, min_score: 1.8, max_score: 2.6, color: '#ED8936', is_final: false },
	{ order: 3, name: { es: 'Satisfactorio', en: 'Satisfactory' }, min_score: 2.6, max_score: 3.4, color: '#ECC94B', is_final: false },
	{ order: 4, name: { es: 'Competente', en: 'Competent' }, min_score: 3.4, max_score: 4.2, color: '#68D391', is_final: false },
	{ order: 5, name: { es: 'Excelente', en: 'Excellent' }, min_score: 4.2, max_score: 5.0, color: '#276749', is_final: true },
];

@Injectable()
export class AcceptanceLevelService {
	constructor(private readonly repository: AcceptanceLevelRepository) {}

	async list(dto: FilterAcceptanceLevelDto) {
		let { survey_type_id } = dto;

		if (!survey_type_id && dto.survey_type_code) {
			const resolved = await this.repository.findSurveyTypeIdByCode(dto.survey_type_code);
			if (!resolved) throw new NotFoundException(`Tipo de encuesta con código "${dto.survey_type_code}" no encontrado`);
			survey_type_id = resolved;
		}

		if (!survey_type_id) throw new BadRequestException('Se requiere survey_type_id o survey_type_code');

		const count = await this.repository.countBySurveyTypeAndPeriod(survey_type_id, dto.academic_period_id);

		if (count === 0) {
			await this.createDefaults(survey_type_id, dto.academic_period_id);
		}

		return await this.repository.findBySurveyTypeAndPeriod(survey_type_id, dto.academic_period_id);
	}

	async bulkUpdate(dto: BulkUpdateAcceptanceLevelsDto) {
		const results: { id: number; updated: boolean }[] = [];

		for (const item of dto.items) {
			const payload: Record<string, any> = {};
			if (item.name !== undefined) payload.name = item.name;
			if (item.min_score !== undefined) payload.min_score = item.min_score;
			if (item.max_score !== undefined) payload.max_score = item.max_score;
			if (item.color !== undefined) payload.color = item.color;
			if (item.order !== undefined) payload.order = item.order;
			if (item.is_final !== undefined) payload.is_final = item.is_final;

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
		const existing = await this.repository.countBySurveyTypeAndPeriod(dto.survey_type_id, dto.academic_period_id);
		if (existing > 0) throw new BadRequestException('Ya existen niveles de aceptación para este tipo de encuesta y período');
		await this.createDefaults(dto.survey_type_id, dto.academic_period_id);
		return await this.repository.findBySurveyTypeAndPeriod(dto.survey_type_id, dto.academic_period_id);
	}

	async copyFromPeriod(dto: CopyAcceptanceLevelsDto): Promise<number> {
		const source = await this.repository.findBySurveyTypeAndPeriod(dto.survey_type_id, dto.source_academic_period_id);

		if (source.length === 0) {
			await this.createDefaults(dto.survey_type_id, dto.target_academic_period_id);
			return DEFAULT_LEVELS.length;
		}

		const targetCount = await this.repository.countBySurveyTypeAndPeriod(dto.survey_type_id, dto.target_academic_period_id);
		if (targetCount > 0) return 0;

		for (const level of source) {
			await this.repository.create({
				survey_type_id: dto.survey_type_id,
				academic_period_id: dto.target_academic_period_id,
				name: level.name,
				order: level.order,
				min_score: level.min_score,
				max_score: level.max_score,
				color: level.color,
				is_final: level.is_final,
				is_active: true,
			});
		}

		return source.length;
	}

	private async createDefaults(survey_type_id: number, academic_period_id: number): Promise<void> {
		for (const level of DEFAULT_LEVELS) {
			await this.repository.create({
				survey_type_id,
				academic_period_id,
				name: level.name,
				order: level.order,
				min_score: level.min_score,
				max_score: level.max_score,
				color: level.color,
				is_final: level.is_final,
				is_active: true,
			});
		}
	}
}
