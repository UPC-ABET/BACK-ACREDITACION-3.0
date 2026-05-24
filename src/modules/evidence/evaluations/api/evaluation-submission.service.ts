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
import { PerformanceLevelEntity } from 'src/modules/academic/performance-levels/model/performance-levels.entity';
import { StudyPlanCourseEntity } from 'src/modules/academic/study-plan-courses/model/study-plan-courses.entity';
import type { I18nText } from 'src/shared/types/i18n';

const toI18n = (text: string): I18nText => ({ es: text, en: text });
const i18nText = (val: I18nText | string | null | undefined): I18nText | null => {
	if (!val) return null;
	if (typeof val === 'string') return toI18n(val);
	return val;
};
const i18nTrim = (val: I18nText | null | undefined): string | null => {
	if (!val) return null;
	const text = typeof val === 'string' ? val : (val.es ?? Object.values(val)[0] ?? '');
	return text.trim();
};

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
	private readonly ASISTIO_STATUS_CODE = 'TG404-T001';
	private readonly NR_STATUS_CODE = 'TG404-T002';
	private readonly NA_STATUS_CODE = 'TG404-T003';
	private readonly PA_GRADE_TYPE_CODE = 'TG205-T003';
	private readonly COM_EVALUATOR_CODE = 'TG403-T001';
	private readonly GER_EVALUATOR_CODE = 'TG403-T002';
	private readonly CAPSTONE_RUBRIC_TYPE_CODE = 'TG401-T001';
	private readonly FINAL_GRADE_TYPE_CODE = 'TG205-T002';
	private readonly PERF_LEVEL_INSTRUMENT_TYPE_CODE = 'TG206-T001';

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
		@InjectRepository(PerformanceLevelEntity)
		private readonly performanceLevelRepo: Repository<PerformanceLevelEntity>,
		@InjectRepository(StudyPlanCourseEntity)
		private readonly studyPlanCourseRepo: Repository<StudyPlanCourseEntity>,
		private readonly dataSource: DataSource,
	) { }

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

	private async resolveStatusTypeIdByCode(code: string): Promise<number> {
		const type = await this.typeRepo.findOne({ where: { code } });
		if (!type) {
			throw new BadRequestException(`Tipo de estado de calificación con código '${code}' no encontrado en core.types.`);
		}
		return type.id;
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
		return type?.code === this.PA_GRADE_TYPE_CODE;
	}

	private async isCapstoneRubric(rubricTypeId: number): Promise<boolean> {
		const type = await this.typeRepo.findOne({ where: { id: rubricTypeId } });
		return type?.code === this.CAPSTONE_RUBRIC_TYPE_CODE;
	}

	private async isFinalEvaluation(gradeTypeId: number): Promise<boolean> {
		const type = await this.typeRepo.findOne({ where: { id: gradeTypeId } });
		return type?.code === this.FINAL_GRADE_TYPE_CODE;
	}

	private async getValidPerformanceLevelValues(rubric: RubricEntity): Promise<Set<number>> {
		const course = await this.studyPlanCourseRepo.findOne({
			where: { id: rubric.study_plan_course_id },
			relations: ['study_plan_academic_period'],
		});
		const academicPeriodId = course?.study_plan_academic_period?.academic_period_id;
		if (!academicPeriodId) return new Set();

		const instrType = await this.typeRepo.findOne({ where: { code: this.PERF_LEVEL_INSTRUMENT_TYPE_CODE } });
		if (!instrType) return new Set();

		const levels = await this.performanceLevelRepo.find({
			where: { instrument_type_id: instrType.id, academic_period_id: academicPeriodId },
		});
		return new Set(levels.map((l) => Number(l.unique_value)));
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
			bucket.maxValues.push(score.rubric_question_criteria.max_value) // string, no number
		}

		let notaRubrica = 0;
		let notaMaximaRubrica = 0;
		const outcomeGrades: Array<{ outcomeId: number; grade: number; maxValue: number }> = [];

		const resultByQuestion = new Map<number, { notaOutcome: number; notaMaxOutcome: number }>();

		for (const [questionId, bucket] of scoresByQuestion) {
			const notaOutcome = bucket.scores.reduce((sum, s) => sum + s.score, 0);
			const notaMaxOutcome = bucket.maxValues.reduce((sum, mv) => sum + mv, 0)
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
		observation: I18nText | string | null | undefined,
		scores: Array<{ rubric_question_criteria_id: number; score: number; commentaries?: I18nText | string }>,
		statusTypeId: number,
	): Promise<EvaluationEntity> {
		let evaluation = await manager.findOne(EvaluationEntity, {
			where: {
				project_student_id: projectStudentId,
				project_evaluator_id: projectEvaluatorId,
			},
		});

		if (evaluation) {
			evaluation.qualification_status_type_id = statusTypeId;
			if (observation !== undefined) {
				evaluation.observation = i18nText(observation);
			}
			await manager.save(evaluation);
		} else {
			evaluation = manager.create(EvaluationEntity, {
				project_student_id: projectStudentId,
				project_evaluator_id: projectEvaluatorId,
				qualification_status_type_id: statusTypeId,
				observation: i18nText(observation),
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
				existingScore.commentaries = i18nText(scoreDto.commentaries) ?? existingScore.commentaries;
				await manager.save(existingScore);
			} else {
				const newScore = manager.create(RubricScoreEntity, {
					evaluation_id: evaluation.id,
					rubric_question_criteria_id: scoreDto.rubric_question_criteria_id,
					score: scoreDto.score,
					commentaries: i18nText(scoreDto.commentaries),
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

		const rubric = await this.rubricRepo.findOne({
			where: { id: dto.rubric_id },
			relations: ['questions', 'questions.criterias'],
		});
		if (!rubric) {
			throw new NotFoundException(`Rúbrica con ID ${dto.rubric_id} no encontrada.`);
		}

		const statusCode = await this.resolveEvaluatorTypeCode(dto.qualification_status_type_id);
		const isNr = statusCode === this.NR_STATUS_CODE;
		const isNa = statusCode === this.NA_STATUS_CODE;
		const isNrOrNa = isNr || isNa;

		const isCapstone = await this.isCapstoneRubric(rubric.rubric_type_id);
		const isFinal = await this.isFinalEvaluation(rubric.grade_type_id);
		const isCapstoneFinal = isCapstone && isFinal;

		// Mapa criteriaId → questionId construido desde la rúbrica
		const criteriaToQuestion = new Map<number, number>();
		for (const question of rubric.questions ?? []) {
			for (const criteria of question.criterias ?? []) {
				criteriaToQuestion.set(criteria.id, question.id);
			}
		}

		if (!isNrOrNa) {
			if (isCapstoneFinal) {
				// Todos los criterios de la rúbrica deben estar en el DTO
				const allCriteriaIds = new Set(criteriaToQuestion.keys());
				const scoredIds = new Set(dto.scores.map((s) => s.rubric_question_criteria_id));
				const missing = [...allCriteriaIds].filter((id) => !scoredIds.has(id));
				if (missing.length > 0) {
					throw new BadRequestException(`Deben calificarse todos los criterios de la rúbrica. Faltan: ${missing.join(', ')}.`);
				}
			} else {
				// Capstone parcial o no capstone: máximo 1 criterio por pregunta
				const countByQuestion = new Map<number, number>();
				for (const scoreDto of dto.scores) {
					const questionId = criteriaToQuestion.get(scoreDto.rubric_question_criteria_id);
					if (!questionId) continue;
					countByQuestion.set(questionId, (countByQuestion.get(questionId) ?? 0) + 1);
				}
				for (const [questionId, count] of countByQuestion) {
					if (count > 1) {
						throw new BadRequestException(`La pregunta ${questionId} tiene ${count} criterios calificados. Solo se permite uno por pregunta.`);
					}
				}
			}

			// Validación de rango / performance levels
			const validPerfLevelValues = isCapstoneFinal
				? await this.getValidPerformanceLevelValues(rubric)
				: null;

			for (const scoreDto of dto.scores) {
				const criteria = criterias.find((c) => c.id === scoreDto.rubric_question_criteria_id);
				if (!criteria) {
					throw new NotFoundException(`Criterio con ID ${scoreDto.rubric_question_criteria_id} no encontrado.`);
				}
				if (validPerfLevelValues) {
					if (!validPerfLevelValues.has(Number(scoreDto.score))) {
						throw new BadRequestException(
							`Puntaje ${scoreDto.score} inválido para rúbrica capstone final. Valores permitidos: ${[...validPerfLevelValues].sort((a, b) => a - b).join(', ')}.`,
						);
					}
				} else {
					if (Number(scoreDto.score) < Number(criteria.min_value) || Number(scoreDto.score) > Number(criteria.max_value)) {
						throw new BadRequestException(`Puntaje ${scoreDto.score} inválido. Rango: [${criteria.min_value} - ${criteria.max_value}].`);
					}
				}
			}
		}

		const queryRunner = this.dataSource.createQueryRunner();
		await queryRunner.connect();
		await queryRunner.startTransaction();

		// Capstone final + NR/NA → todos los criterios en 0; cualquier otro caso → lo que manda el front
		const scoresToSave = isCapstoneFinal && isNrOrNa
			? [...criteriaToQuestion.keys()].map((criteriaId) => ({ rubric_question_criteria_id: criteriaId, score: 0 }))
			: dto.scores;

		try {
			const evaluation = await this.saveEvaluationScores(
				queryRunner.manager,
				dto.project_student_id,
				dto.project_evaluator_id,
				dto.observation,
				scoresToSave,
				dto.qualification_status_type_id,
			);

			if (!isCapstoneFinal) {
				// Capstone parcial / no capstone (NR/NA o normal):
				// borrar scores de criterios alternativos de las mismas preguntas enviadas
				const submittedCriteriaIds = new Set(dto.scores.map((s) => s.rubric_question_criteria_id));
				const questionsInSubmission = new Set(
					dto.scores
						.map((s) => criteriaToQuestion.get(s.rubric_question_criteria_id))
						.filter((qId): qId is number => qId !== undefined),
				);
				const criteriaToDelete: number[] = [];
				for (const question of rubric.questions ?? []) {
					if (!questionsInSubmission.has(question.id)) continue;
					for (const criteria of question.criterias ?? []) {
						if (!submittedCriteriaIds.has(criteria.id)) {
							criteriaToDelete.push(criteria.id);
						}
					}
				}
				if (criteriaToDelete.length > 0) {
					await queryRunner.manager.delete(RubricScoreEntity, {
						evaluation_id: evaluation.id,
						rubric_question_criteria_id: In(criteriaToDelete),
					});
				}
			}

			// Resolver tipo de evaluador
			const evaluatorCode = await this.resolveEvaluatorTypeCode(evaluator.evaluator_type_id);

			// Usar rúbrica ya resuelta
			const isPa = await this.isPaRubric(rubric.id);

			let finalOutcomeGrades: Array<{ outcomeId: number; grade: number; maxValue: number }>;

			if (evaluatorCode === this.COM_EVALUATOR_CODE) {
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
			} else if (evaluatorCode === this.GER_EVALUATOR_CODE && isPa) {
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
		const asistioStatusTypeId = await this.resolveStatusTypeIdByCode(this.ASISTIO_STATUS_CODE);
		const nrStatusTypeId = await this.resolveStatusTypeIdByCode(this.NR_STATUS_CODE);

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
					qualification_status_type_id: nrStatusTypeId,
					observation: i18nText(dto.observation),
					register_at: new Date(),
				});
			} else {
				evaluation.observation = i18nText(dto.observation);
			}

			if (!evaluation.observation || !i18nTrim(evaluation.observation)) {
				evaluation.qualification_status_type_id = nrStatusTypeId;
			} else {
				evaluation.qualification_status_type_id = asistioStatusTypeId;
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

		const asistioStatusTypeId = await this.resolveStatusTypeIdByCode(this.ASISTIO_STATUS_CODE);

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

				if (!dto.is_pa && !i18nTrim(evaluation.observation)) {
					throw new BadRequestException(`Debe ingresar y guardar las observaciones para el alumno ${ps.student_section_enrollment_id}.`);
				}

				const criteriaCount = await queryRunner.manager.count(RubricScoreEntity, {
					where: { evaluation_id: evaluation.id },
				});

				if (criteriaCount < totalCriteria) {
					throw new BadRequestException(`Debe calificar todos los criterios para el alumno ${ps.student_section_enrollment_id}.`);
				}

				evaluation.qualification_status_type_id = asistioStatusTypeId;
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
