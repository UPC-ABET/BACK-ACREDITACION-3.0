import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { EvaluationEntity } from '../model/evaluations.entity';
import { SubmitEvaluationDto, SaveObservationDto, FinalizeProjectDto } from '../model/evaluations.dtos';
import { ProjectStudentEntity } from 'src/modules/evaluation/project-students/model/project-students.entity';
import { ProjectEvaluatorEntity } from 'src/modules/evaluation/project-evaluators/model/project-evaluators.entity';
import { RubricQuestionCriteriaEntity } from 'src/modules/evaluation/rubric-question-criterias/model/rubric-question-criterias.entity';
import { RubricQuestionEntity } from 'src/modules/evaluation/rubric-questions/model/rubric-questions.entity';
import { RubricEntity } from 'src/modules/evaluation/rubrics/model/rubrics.entity';
import { StudentCourseOutcomeGradeEntity } from 'src/modules/evidence/student-course-outcome-grades/model/student-course-outcome-grades.entity';
import { StudentSectionEnrollmentEntity } from 'src/modules/academic/student-section-enrollments/model/student-section-enrollments.entity';
import { ProjectEntity } from 'src/modules/evaluation/projects/model/projects.entity';
import { RubricScoreEntity } from 'src/modules/evaluation/rubric-scores/model/rubric-scores.entity';
import { TypeEntity } from 'src/modules/core/types/model/types.entity';

/**
 * EvaluationSubmissionService
 *
 * Servicio que implementa la lógica de calificación de rúbricas (flujo completo).
 *
 * Reglas de negocio implementadas:
 * - R-NOT-001: Cálculo de Nivel Alcanzado por outcome (umbrales 0.33/0.67)
 * - R-NOT-002: Nota final escalada a vigesimal (20)
 * - R-NOT-003: NotaOutcome = Sum(NotaCriterio)
 * - R-NOT-004: NotaRubrica = Sum(NotaOutcome)
 * - R-NOT-005: Guardada se activa si hay observación o todos los criterios están completos
 * - R-NOT-008: Comité (COM) promedia notas de todos los evaluadores del mismo tipo
 * - R-NOT-009: Gerente (GER) en WASC escribe directo (sin promediar)
 * - R-NOT-010: Validación de rango de puntaje contra min_value/max_value del criterio
 * - R-NOT-011: Exclusión de alumnos retirados en finalización
 * - R-NOT-012: Validación de completitud al guardar calificación
 * - R-NOT-013: Observación obligatoria salvo en PA
 * - R-NOT-014: Observación vacía revierte estado
 */
@Injectable()
export class EvaluationSubmissionService {
	private readonly COMPLETED_STATUS_TYPE_ID = 1;
	private readonly ASISTIO_STATUS_TYPE_ID = 1;
	private readonly NR_STATUS_TYPE_ID = 2;

	constructor(
		@InjectRepository(EvaluationEntity)
		private readonly evaluationRepo: Repository<EvaluationEntity>,
		@InjectRepository(ProjectStudentEntity)
		private readonly studentRepo: Repository<ProjectStudentEntity>,
		@InjectRepository(ProjectEvaluatorEntity)
		private readonly evaluatorRepo: Repository<ProjectEvaluatorEntity>,
		@InjectRepository(RubricQuestionCriteriaEntity)
		private readonly criteriaRepo: Repository<RubricQuestionCriteriaEntity>,
		@InjectRepository(RubricQuestionEntity)
		private readonly questionRepo: Repository<RubricQuestionEntity>,
		@InjectRepository(RubricEntity)
		private readonly rubricRepo: Repository<RubricEntity>,
		@InjectRepository(RubricScoreEntity)
		private readonly scoreRepo: Repository<RubricScoreEntity>,
		@InjectRepository(StudentCourseOutcomeGradeEntity)
		private readonly outcomeGradeRepo: Repository<StudentCourseOutcomeGradeEntity>,
		@InjectRepository(StudentSectionEnrollmentEntity)
		private readonly enrollmentRepo: Repository<StudentSectionEnrollmentEntity>,
		@InjectRepository(ProjectEntity)
		private readonly projectRepo: Repository<ProjectEntity>,
		@InjectRepository(TypeEntity)
		private readonly typeRepo: Repository<TypeEntity>,
		private readonly dataSource: DataSource,
	) {}

	private computeLevel(score: number, maxValue: number): number {
		if (!maxValue || maxValue === 0) return 1;
		const ratio = Math.round((score / maxValue) * 100) / 100;
		if (ratio >= 0 && ratio <= 0.33) return 1;
		if (ratio >= 0.34 && ratio <= 0.67) return 2;
		return 3;
	}

	private scaleTo20(notaRubrica: number, notaMaxima: number): number {
		if (!notaMaxima || notaMaxima === 0) return 0;
		return Math.round(((notaRubrica * 20) / notaMaxima) * 100) / 100;
	}

	private async resolveEvaluatorTypeCode(evaluatorTypeId: number): Promise<string | null> {
		const type = await this.typeRepo.findOne({ where: { id: evaluatorTypeId } });
		return type?.code ?? null;
	}

	private async isPaRubric(rubricId?: number, gradeTypeId?: number): Promise<boolean> {
		if (!gradeTypeId && !rubricId) return false;
		let gTypeId = gradeTypeId;
		if (!gTypeId && rubricId) {
			const rubric = await this.rubricRepo.findOne({ where: { id: rubricId } });
			gTypeId = rubric?.grade_type_id;
		}
		if (!gTypeId) return false;
		const type = await this.typeRepo.findOne({ where: { id: gTypeId } });
		return type?.code === 'PA';
	}

	private async getRubricForProject(projectId: number): Promise<{ rubric: RubricEntity | null; studyPlanCourseId: number | null }> {
		const student = await this.studentRepo.findOne({
			where: { project_id: projectId },
			relations: ['student_section_enrollment', 'student_section_enrollment.course_section'],
		});
		if (!student?.student_section_enrollment) return { rubric: null, studyPlanCourseId: null };

		const studyPlanCourseId = student.student_section_enrollment.course_section?.study_plan_course_id;
		if (!studyPlanCourseId) return { rubric: null, studyPlanCourseId: null };

		const rubric = await this.rubricRepo.findOne({
			where: { study_plan_course_id: studyPlanCourseId },
			relations: ['questions', 'questions.criterias'],
		});
		return { rubric, studyPlanCourseId };
	}

	private async aggregateScoresByOutcome(
		manager: any,
		evaluationId: number,
	): Promise<{
		scoresByQuestion: Map<number, { notaOutcome: number; notaMaxOutcome: number }>;
		notaRubrica: number;
		notaMaximaRubrica: number;
		outcomeGrades: Array<{ outcomeId: number; grade: number; maxValue: number }>;
	}> {
		const allScores = await manager.find(RubricScoreEntity, {
			where: { evaluation_id: evaluationId },
			relations: ['rubric_question_criteria', 'rubric_question_criteria.question'],
		});

		const scoresByQuestion = new Map<number, { scores: RubricScoreEntity[]; maxValues: number[] }>();
		for (const score of allScores) {
			const questionId = score.rubric_question_criteria?.rubric_question_id;
			if (!questionId) continue;
			if (!scoresByQuestion.has(questionId)) {
				scoresByQuestion.set(questionId, { scores: [], maxValues: [] });
			}
			const bucket = scoresByQuestion.get(questionId)!;
			bucket.scores.push(score);
			bucket.maxValues.push(score.rubric_question_criteria.max_value);
		}

		let notaRubrica = 0;
		let notaMaximaRubrica = 0;
		const outcomeGrades: Array<{ outcomeId: number; grade: number; maxValue: number }> = [];

		const resultByQuestion = new Map<number, { notaOutcome: number; notaMaxOutcome: number }>();

		for (const [questionId, bucket] of scoresByQuestion) {
			const notaOutcome = bucket.scores.reduce((sum, s) => sum + s.score, 0);
			const notaMaxOutcome = bucket.maxValues.reduce((sum, mv) => sum + mv, 0);
			notaRubrica += notaOutcome;
			notaMaximaRubrica += notaMaxOutcome;
			resultByQuestion.set(questionId, { notaOutcome, notaMaxOutcome });

			const question = await manager.findOne(RubricQuestionEntity, { where: { id: questionId } });
			if (question?.outcome_id) {
				outcomeGrades.push({ outcomeId: question.outcome_id, grade: notaOutcome, maxValue: notaMaxOutcome });
			}
		}

		return { scoresByQuestion: resultByQuestion, notaRubrica, notaMaximaRubrica, outcomeGrades };
	}

	private async upsertOutcomeGrades(manager: any, studentSectionEnrollmentId: number, outcomeGrades: Array<{ outcomeId: number; grade: number; maxValue: number }>): Promise<void> {
		for (const og of outcomeGrades) {
			const existing = await manager.findOne(StudentCourseOutcomeGradeEntity, {
				where: {
					student_section_enrollment_id: studentSectionEnrollmentId,
					outcome_id: og.outcomeId,
				},
			});
			if (existing) {
				existing.grade = og.grade;
				await manager.save(existing);
			} else {
				const newGrade = manager.create(StudentCourseOutcomeGradeEntity, {
					student_section_enrollment_id: studentSectionEnrollmentId,
					outcome_id: og.outcomeId,
					grade: og.grade,
				});
				await manager.save(newGrade);
			}
		}
	}

	private async saveEvaluationScores(
		manager: any,
		projectStudentId: number,
		projectEvaluatorId: number,
		observation: string | null | undefined,
		scores: Array<{ rubric_question_criteria_id: number; score: number; commentaries?: string }>,
	): Promise<EvaluationEntity> {
		let evaluation = await manager.findOne(EvaluationEntity, {
			where: {
				project_student_id: projectStudentId,
				project_evaluator_id: projectEvaluatorId,
			},
		});

		if (evaluation) {
			if (observation !== undefined) {
				evaluation.observation = observation;
			}
			await manager.save(evaluation);
		} else {
			evaluation = manager.create(EvaluationEntity, {
				project_student_id: projectStudentId,
				project_evaluator_id: projectEvaluatorId,
				qualification_status_type_id: this.COMPLETED_STATUS_TYPE_ID,
				observation: observation ?? null,
				register_at: new Date(),
				is_active: true,
			});
			evaluation = await manager.save(evaluation);
		}

		for (const scoreDto of scores) {
			const existingScore = await manager.findOne(RubricScoreEntity, {
				where: {
					evaluation_id: evaluation.id,
					rubric_question_criteria_id: scoreDto.rubric_question_criteria_id,
				},
			});

			if (existingScore) {
				existingScore.score = scoreDto.score;
				existingScore.commentaries = scoreDto.commentaries ?? existingScore.commentaries;
				await manager.save(existingScore);
			} else {
				const newScore = manager.create(RubricScoreEntity, {
					evaluation_id: evaluation.id,
					rubric_question_criteria_id: scoreDto.rubric_question_criteria_id,
					score: scoreDto.score,
					commentaries: scoreDto.commentaries,
					is_active: true,
				});
				await manager.save(newScore);
			}
		}

		return evaluation;
	}

	/**
	 * Envía/actualiza una calificación de criterio individual.
	 *
	 * Flujo:
	 * 1. Valida evaluador/estudiante y rangos
	 * 2. UPSERT en rubric_scores
	 * 3. Según el tipo de evaluador:
	 *    - COM: promedia todos los COM del proyecto (R-NOT-008)
	 *    - GER: escribe directo (R-NOT-009)
	 *    - Otros: escribe directo (DOC, CLI, COA)
	 * 4. Persiste outcome grades escalados
	 * 5. Devuelve nota vigesimal
	 */
	async submitEvaluation(dto: SubmitEvaluationDto): Promise<{ success: boolean; evaluationId: number; scaledScore?: number }> {
		const evaluator = await this.evaluatorRepo.findOne({
			where: { id: dto.project_evaluator_id },
			relations: ['project'],
		});
		const student = await this.studentRepo.findOne({
			where: { id: dto.project_student_id },
			relations: ['project'],
		});

		if (!evaluator || !student) {
			throw new NotFoundException('Evaluador o estudiante no encontrado.');
		}
		if (evaluator.project_id !== student.project_id) {
			throw new ConflictException('El estudiante y el evaluador no pertenecen al mismo proyecto.');
		}

		const criteriaIds = dto.scores.map((s) => s.rubric_question_criteria_id);
		const criterias = await this.criteriaRepo.find({ where: { id: In(criteriaIds) } });

		for (const scoreDto of dto.scores) {
			const criteria = criterias.find((c) => c.id === scoreDto.rubric_question_criteria_id);
			if (!criteria) {
				throw new NotFoundException(`Criterio con ID ${scoreDto.rubric_question_criteria_id} no encontrado.`);
			}
			if (scoreDto.score < criteria.min_value || scoreDto.score > criteria.max_value) {
				throw new BadRequestException(`Puntaje ${scoreDto.score} inválido. Rango: [${criteria.min_value} - ${criteria.max_value}].`);
			}
		}

		const queryRunner = this.dataSource.createQueryRunner();
		await queryRunner.connect();
		await queryRunner.startTransaction();

		try {
			const evaluation = await this.saveEvaluationScores(queryRunner.manager, dto.project_student_id, dto.project_evaluator_id, dto.observation, dto.scores);

			// Resolver tipo de evaluador
			const evaluatorCode = await this.resolveEvaluatorTypeCode(evaluator.evaluator_type_id);

			// Resolver rúbrica asociada
			const { rubric } = await this.getRubricForProject(evaluator.project_id);
			const isPa = rubric ? await this.isPaRubric(rubric.id) : false;

			let finalOutcomeGrades: Array<{ outcomeId: number; grade: number; maxValue: number }>;

			if (evaluatorCode === 'COM') {
				// R-NOT-008: COM — promediar todos los COM del proyecto
				const comEvaluators = await queryRunner.manager.find(ProjectEvaluatorEntity, {
					where: { project_id: evaluator.project_id, evaluator_type_id: evaluator.evaluator_type_id },
				});
				const comEvaluatorIds = comEvaluators.map((e) => e.id);

				// Acumular scores por outcome a través de todos los evaluadores COM
				const aggregatedGrades = new Map<number, { sum: number; count: number; maxValue: number }>();

				for (const comEvalId of comEvaluatorIds) {
					const comStudentEval = await queryRunner.manager.findOne(EvaluationEntity, {
						where: { project_student_id: dto.project_student_id, project_evaluator_id: comEvalId },
					});
					if (!comStudentEval) continue;

					const { outcomeGrades: comGrades } = await this.aggregateScoresByOutcome(queryRunner.manager, comStudentEval.id);
					for (const og of comGrades) {
						const existing = aggregatedGrades.get(og.outcomeId);
						if (existing) {
							existing.sum += og.grade;
							existing.count += 1;
						} else {
							aggregatedGrades.set(og.outcomeId, { sum: og.grade, count: 1, maxValue: og.maxValue });
						}
					}
				}

				finalOutcomeGrades = [];
				for (const [outcomeId, data] of aggregatedGrades) {
					const average = data.count > 0 ? Math.round((data.sum / data.count) * 100) / 100 : 0;
					finalOutcomeGrades.push({ outcomeId, grade: average, maxValue: data.maxValue });
				}

				// UPSERT con promedios del COM
				await this.upsertOutcomeGrades(queryRunner.manager, student.student_section_enrollment_id, finalOutcomeGrades);
			} else if (evaluatorCode === 'GER' && isPa) {
				// R-NOT-009: GER en WASC — escribe directo
				const { outcomeGrades } = await this.aggregateScoresByOutcome(queryRunner.manager, evaluation.id);
				finalOutcomeGrades = outcomeGrades;
				await this.upsertOutcomeGrades(queryRunner.manager, student.student_section_enrollment_id, finalOutcomeGrades);
			} else {
				// DOC, CLI, COA, o GER en ABET — escribe directo
				const { outcomeGrades } = await this.aggregateScoresByOutcome(queryRunner.manager, evaluation.id);
				finalOutcomeGrades = outcomeGrades;
				await this.upsertOutcomeGrades(queryRunner.manager, student.student_section_enrollment_id, finalOutcomeGrades);
			}

			await queryRunner.commitTransaction();

			// Calcular nota vigesimal para respuesta
			const allOutcomeGrades = finalOutcomeGrades || [];
			const notaRubrica = allOutcomeGrades.reduce((s, og) => s + og.grade, 0);
			const notaMaxRubrica = allOutcomeGrades.reduce((s, og) => s + og.maxValue, 0);
			const scaledScore = this.scaleTo20(notaRubrica, notaMaxRubrica);

			return { success: true, evaluationId: evaluation.id, scaledScore };
		} catch (error) {
			await queryRunner.rollbackTransaction();
			throw error;
		} finally {
			await queryRunner.release();
		}
	}

	/**
	 * Guarda/actualiza la observación de una evaluación (R-NOT-014)
	 */
	async saveObservation(dto: SaveObservationDto): Promise<{ success: boolean }> {
		const queryRunner = this.dataSource.createQueryRunner();
		await queryRunner.connect();
		await queryRunner.startTransaction();

		try {
			let evaluation = await queryRunner.manager.findOne(EvaluationEntity, {
				where: {
					project_student_id: dto.project_student_id,
					project_evaluator_id: dto.project_evaluator_id,
				},
			});

			if (!evaluation) {
				evaluation = queryRunner.manager.create(EvaluationEntity, {
					project_student_id: dto.project_student_id,
					project_evaluator_id: dto.project_evaluator_id,
					qualification_status_type_id: this.NR_STATUS_TYPE_ID,
					observation: dto.observation?.trim() ?? null,
					register_at: new Date(),
				});
			} else {
				evaluation.observation = dto.observation?.trim() ?? null;
			}

			if (!evaluation.observation) {
				evaluation.qualification_status_type_id = this.NR_STATUS_TYPE_ID;
			} else {
				evaluation.qualification_status_type_id = this.ASISTIO_STATUS_TYPE_ID;
			}

			await queryRunner.manager.save(evaluation);
			await queryRunner.commitTransaction();

			return { success: true };
		} catch (error) {
			await queryRunner.rollbackTransaction();
			throw error;
		} finally {
			await queryRunner.release();
		}
	}

	/**
	 * Finaliza la calificación de un proyecto (R-NOT-011, R-NOT-012, R-NOT-013)
	 */
	async finalizeProject(dto: FinalizeProjectDto): Promise<{ success: boolean; message: string }> {
		const project = await this.projectRepo.findOne({
			where: { id: dto.project_id },
			relations: ['students', 'students.student_section_enrollment'],
		});

		if (!project) {
			throw new NotFoundException('Proyecto no encontrado.');
		}

		const { rubric } = await this.getRubricForProject(dto.project_id);
		if (!rubric) {
			throw new BadRequestException('El proyecto no tiene una rúbrica asociada.');
		}

		const totalCriteria = rubric.questions?.reduce((sum, q) => sum + (q.criterias?.length || 0), 0) || 0;

		const queryRunner = this.dataSource.createQueryRunner();
		await queryRunner.connect();
		await queryRunner.startTransaction();

		try {
			for (const ps of project.students) {
				const evaluation = await queryRunner.manager.findOne(EvaluationEntity, {
					where: {
						project_student_id: ps.id,
						project_evaluator_id: dto.evaluator_id,
					},
				});

				if (!ps.student_section_enrollment) continue;

				if (!evaluation) {
					throw new BadRequestException(`Debe calificar al alumno con enrollment ${ps.student_section_enrollment_id}.`);
				}

				if (!dto.is_pa && (!evaluation.observation || !evaluation.observation.trim())) {
					throw new BadRequestException(`Debe ingresar y guardar las observaciones para el alumno ${ps.student_section_enrollment_id}.`);
				}

				const criteriaCount = await queryRunner.manager.count(RubricScoreEntity, {
					where: { evaluation_id: evaluation.id },
				});

				if (criteriaCount < totalCriteria) {
					throw new BadRequestException(`Debe calificar todos los criterios para el alumno ${ps.student_section_enrollment_id}.`);
				}

				evaluation.qualification_status_type_id = this.ASISTIO_STATUS_TYPE_ID;
				await queryRunner.manager.save(evaluation);
			}

			await queryRunner.commitTransaction();
			return { success: true, message: 'Calificación guardada exitosamente.' };
		} catch (error) {
			await queryRunner.rollbackTransaction();
			throw error;
		} finally {
			await queryRunner.release();
		}
	}

	async getEvaluationById(id: number): Promise<EvaluationEntity> {
		const evaluation = await this.evaluationRepo.findOne({
			where: { id },
			relations: ['scores', 'project_student', 'project_evaluator'],
		});

		if (!evaluation) {
			throw new NotFoundException('Evaluación no encontrada.');
		}

		return evaluation;
	}

	async getStudentEvaluations(studentId: number): Promise<EvaluationEntity[]> {
		return await this.evaluationRepo.find({
			where: { project_student_id: studentId },
			relations: ['scores', 'project_evaluator'],
		});
	}

	async getEvaluatorEvaluations(evaluatorId: number): Promise<EvaluationEntity[]> {
		return await this.evaluationRepo.find({
			where: { project_evaluator_id: evaluatorId },
			relations: ['scores', 'project_student'],
		});
	}
}
