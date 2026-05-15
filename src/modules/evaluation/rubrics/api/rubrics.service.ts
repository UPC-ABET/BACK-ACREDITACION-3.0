import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { RubricRepository } from '../core/rubrics.repository';
import { RubricValidation } from '../core/rubrics.validation';

import { CreateRubricDto, UpdateRubricDto } from '../model/rubrics.dtos';
import { DataSource, EntityManager, In } from 'typeorm';
import { RubricQuestionEntity } from 'src/modules/evaluation/rubric-questions/model/rubric-questions.entity';
import { RubricQuestionCriteriaEntity } from 'src/modules/evaluation/rubric-question-criterias/model/rubric-question-criterias.entity';
import { RubricScoreEntity } from 'src/modules/evaluation/rubric-scores/model/rubric-scores.entity';

@Injectable()
export class RubricService extends BaseService<RubricRepository> {
	constructor(
		protected readonly repository: RubricRepository,
		protected readonly dataSource: DataSource,
	) {
		super(repository);
	}

	async create(dto: CreateRubricDto, manager?: EntityManager) {
		await RubricValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdateRubricDto, manager?: EntityManager) {
		await RubricValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	/**
	 * Borra una rúbrica con cascada (R-RUB-018).
	 *
	 * Retorna:
	 * - code 0: eliminado exitosamente
	 * - code 1: tiene calificaciones (no se permite)
	 * - code 2: no existe
	 */
	async delete(id: number, manager?: EntityManager): Promise<{ code: number; message: string; data: any }> {
		const rubric = await this.repository.findOneById(id);
		if (!rubric) {
			return { code: 2, message: 'La rúbrica no existe.', data: null };
		}

		const queryRunner = this.dataSource.createQueryRunner();
		await queryRunner.connect();
		await queryRunner.startTransaction();

		try {
			const questions = await queryRunner.manager.find(RubricQuestionEntity, {
				where: { rubric_id: id },
			});
			const questionIds = questions.map((q) => q.id);

			// Verificar si hay scores asociados
			if (questionIds.length > 0) {
				const criteriaList = await queryRunner.manager.find(RubricQuestionCriteriaEntity, {
					where: { rubric_question_id: In(questionIds) },
				});
				const criteriaIds = criteriaList.map((c) => c.id);
				if (criteriaIds.length > 0) {
					const scoreCount = await queryRunner.manager.count(RubricScoreEntity, {
						where: { rubric_question_criteria_id: In(criteriaIds) },
					});
					if (scoreCount > 0) {
						await queryRunner.rollbackTransaction();
						return { code: 1, message: 'No se puede eliminar una rúbrica con calificaciones registradas.', data: null };
					}
				}

				// Eliminar criterios
				await queryRunner.manager.delete(RubricQuestionCriteriaEntity, { rubric_question_id: In(questionIds) });
			}

			// Eliminar preguntas
			await queryRunner.manager.delete(RubricQuestionEntity, { rubric_id: id });
			// Eliminar rúbrica
			await queryRunner.manager.delete(rubric.constructor, id);

			await queryRunner.commitTransaction();
			return { code: 0, message: 'Rúbrica eliminada exitosamente.', data: null };
		} catch (error) {
			await queryRunner.rollbackTransaction();
			throw error;
		} finally {
			await queryRunner.release();
		}
	}
}
