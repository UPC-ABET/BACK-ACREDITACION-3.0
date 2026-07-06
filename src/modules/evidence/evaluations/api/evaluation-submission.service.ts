import {
	Injectable,
	NotFoundException,
	BadRequestException,
	ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager, In } from 'typeorm';
import { EvaluationEntity } from '../model/evaluations.entity';
import { EvaluationRepository } from '../core/evaluations.repository';
import {
	SubmitEvaluationDto,
	SaveObservationDto,
	FinalizeProjectDto,
} from '../model/evaluations.dtos';
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
import { type I18nText, i18nText, i18nTrim } from 'src/shared/types/i18n';
import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';
import { evaluationsValidationStrings } from '../config/strings/evaluations.validation';

/**
 * EvaluationSubmissionService
 *
 * Service implementing rubric grading logic (full flow).
 *
 * Implemented business rules:
 * - R-NOT-001: Achievement Level calculation per outcome (thresholds 0.33/0.67)
 * - R-NOT-002: Final grade scaled to 20-point scale
 * - R-NOT-003: NotaOutcome = Sum(NotaCriteria)
 * - R-NOT-004: NotaRubrica = Sum(NotaOutcome)
 * - R-NOT-005: Saved status activates if observation exists or all criteria are complete
 * - R-NOT-008/009: single evaluation per (student, rubric); any authorized evaluator
 *   writes directly on that same evaluation (overwrites, no averaging across evaluators)
 * - R-NOT-010: Score range validation against min_value/max_value of the criteria
 * - R-NOT-011: Exclusion of withdrawn students on finalization
 * - R-NOT-012: Completeness validation when saving grade
 * - R-NOT-013: Observation required except in PA
 * - R-NOT-014: Empty observation reverts status
 * - R-NOT-015: DOC role (teacher) can only view, not grade
 * - R-NOT-016: Maximum 1 evaluator per role type in the project
 */
@Injectable()
export class EvaluationSubmissionService {
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
		private readonly evaluationRepository: EvaluationRepository,
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

	private async canEvaluatorTypeGrade(evaluatorTypeId: number): Promise<boolean> {
		const type = await this.typeRepo.findOne({ where: { id: evaluatorTypeId } });
		return type?.extra?.canEvaluate === true;
	}

	private async resolveStatusTypeIdByCode(code: string): Promise<number> {
		const type = await this.typeRepo.findOne({ where: { code } });
		if (!type) {
			throw new BadRequestException(evaluationsValidationStrings.error.statusTypeNotFound);
		}
		return type.id;
	}

	private async isCapstoneRubric(rubricTypeId: number): Promise<boolean> {
		const type = await this.typeRepo.findOne({ where: { id: rubricTypeId } });
		return type?.code === TYPE_CODES.RUBRIC_TYPE.CAPSTONE;
	}

	private async isMultipleCompetencyScope(competencyScopeTypeId: number): Promise<boolean> {
		const type = await this.typeRepo.findOne({ where: { id: competencyScopeTypeId } });
		return type?.code === TYPE_CODES.COMPETENCY_SCOPE.MULTIPLE;
	}

	private async getValidPerformanceLevelValues(rubric: RubricEntity): Promise<Set<number>> {
		const course = await this.studyPlanCourseRepo.findOne({
			where: { id: rubric.studyPlanCourseId },
			relations: ['studyPlanAcademicPeriod'],
		});
		const academicPeriodId = course?.studyPlanAcademicPeriod?.academicPeriodId;
		if (!academicPeriodId) return new Set();

		const instrType = await this.typeRepo.findOne({
			where: { code: TYPE_CODES.PERF_LEVEL_INSTRUMENT.TYPE },
		});
		if (!instrType) return new Set();

		const levels = await this.performanceLevelRepo.find({
			where: { instrumentTypeId: instrType.id, academicPeriodId: academicPeriodId },
		});
		return new Set(levels.map((l) => Number(l.uniqueValue)));
	}

	private async getHighestPerformanceLevelValue(rubric: RubricEntity): Promise<number> {
		const course = await this.studyPlanCourseRepo.findOne({
			where: { id: rubric.studyPlanCourseId },
			relations: ['studyPlanAcademicPeriod'],
		});
		const academicPeriodId = course?.studyPlanAcademicPeriod?.academicPeriodId;
		if (!academicPeriodId) return 0;

		const instrType = await this.typeRepo.findOne({
			where: { code: TYPE_CODES.PERF_LEVEL_INSTRUMENT.TYPE },
		});
		if (!instrType) return 0;

		const levels = await this.performanceLevelRepo.find({
			where: { instrumentTypeId: instrType.id, academicPeriodId: academicPeriodId },
		});
		if (levels.length === 0) return 0;

		return Math.max(...levels.map((l) => Number(l.uniqueValue)));
	}

	private async getRubricsForProject(
		projectId: number,
	): Promise<{ rubrics: RubricEntity[]; studyPlanCourseId: number | null }> {
		const student = await this.studentRepo.findOne({
			where: { projectId: projectId },
			relations: ['studentSectionEnrollment', 'studentSectionEnrollment.courseSection'],
		});
		if (!student?.studentSectionEnrollment) return { rubrics: [], studyPlanCourseId: null };

		const courseSection = student.studentSectionEnrollment.courseSection;
		const courseId = courseSection?.courseId;
		const academicPeriodId = courseSection?.academicPeriodId;
		if (!courseId || !academicPeriodId) return { rubrics: [], studyPlanCourseId: null };

		const rubrics = await this.evaluationRepository.getActiveRubricsForCoursePeriod(
			courseId,
			academicPeriodId,
		);

		return { rubrics, studyPlanCourseId: rubrics[0]?.studyPlanCourseId ?? null };
	}

	private async aggregateScoresByOutcome(
		manager: EntityManager,
		evaluationId: number,
		highestPerformanceLevelValue: number,
	): Promise<{
		scoresByQuestion: Map<number, { notaOutcome: number; notaMaxOutcome: number }>;
		notaRubrica: number;
		notaMaximaRubrica: number;
		outcomeGrades: Array<{
			outcomeId: number;
			grade: number;
			maxValue: number;
			maxOutcome: number;
		}>;
	}> {
		const allScores = await manager.find(RubricScoreEntity, {
			where: { evaluationId: evaluationId },
			relations: ['rubricQuestionCriteria', 'rubricQuestionCriteria.question'],
		});

		const scoresByQuestion = new Map<
			number,
			{ scores: RubricScoreEntity[]; maxValues: number[] }
		>();
		for (const score of allScores) {
			const questionId = score.rubricQuestionCriteria?.rubricQuestionId;
			if (!questionId) continue;
			if (!scoresByQuestion.has(questionId)) {
				scoresByQuestion.set(questionId, { scores: [], maxValues: [] });
			}
			const bucket = scoresByQuestion.get(questionId)!;
			bucket.scores.push(score);
			bucket.maxValues.push(score.rubricQuestionCriteria.maxValue); // string, no number
		}

		let notaRubrica = 0;
		let notaMaximaRubrica = 0;
		const outcomeGrades: Array<{
			outcomeId: number;
			grade: number;
			maxValue: number;
			maxOutcome: number;
		}> = [];

		const resultByQuestion = new Map<number, { notaOutcome: number; notaMaxOutcome: number }>();

		for (const [questionId, bucket] of scoresByQuestion) {
			const notaOutcome = bucket.scores.reduce((sum, s) => sum + s.score, 0);
			const notaMaxOutcome = bucket.maxValues.reduce((sum, mv) => sum + mv, 0);
			notaRubrica += notaOutcome;
			notaMaximaRubrica += notaMaxOutcome;
			resultByQuestion.set(questionId, { notaOutcome, notaMaxOutcome });

			const question = await manager.findOne(RubricQuestionEntity, { where: { id: questionId } });
			if (question?.outcomeId) {
				const criteriaCount = bucket.maxValues.length;
				outcomeGrades.push({
					outcomeId: question.outcomeId,
					grade: notaOutcome,
					maxValue: notaMaxOutcome,
					maxOutcome: criteriaCount * highestPerformanceLevelValue,
				});
			}
		}

		return { scoresByQuestion: resultByQuestion, notaRubrica, notaMaximaRubrica, outcomeGrades };
	}

	private async upsertOutcomeGrades(
		manager: EntityManager,
		studentSectionEnrollmentId: number,
		evaluationId: number,
		outcomeGrades: Array<{
			outcomeId: number;
			grade: number;
			maxValue: number;
			maxOutcome: number;
		}>,
	): Promise<void> {
		for (const og of outcomeGrades) {
			const existing = await manager.findOne(StudentCourseOutcomeGradeEntity, {
				where: {
					studentSectionEnrollmentId: studentSectionEnrollmentId,
					outcomeId: og.outcomeId,
					evaluationId: evaluationId,
				},
			});
			if (existing) {
				existing.grade = og.grade;
				existing.extra = { ...existing.extra, max_outcome: og.maxOutcome };
				await manager.save(existing);
			} else {
				const newGrade = manager.create(StudentCourseOutcomeGradeEntity, {
					studentSectionEnrollmentId: studentSectionEnrollmentId,
					outcomeId: og.outcomeId,
					evaluationId: evaluationId,
					grade: og.grade,
					extra: { max_outcome: og.maxOutcome },
				});
				await manager.save(newGrade);
			}
		}
	}

	// One evaluation per (projectStudentId, rubricId): any authorized evaluator overwrites the
	// same row (R-NOT-008/009). projectEvaluatorId is not part of the identity — it's metadata
	// tracking who last touched the record.
	private async saveEvaluationScores(
		manager: EntityManager,
		projectStudentId: number,
		projectEvaluatorId: number,
		rubricId: number,
		observation: I18nText | string | null | undefined,
		scores: Array<{
			rubricQuestionCriteriaId: number;
			score: number;
			commentaries?: I18nText | string;
		}>,
		statusTypeId: number,
	): Promise<EvaluationEntity> {
		let evaluation = await manager.findOne(EvaluationEntity, {
			where: {
				projectStudentId: projectStudentId,
				rubricId: rubricId,
			},
		});

		if (evaluation) {
			evaluation.projectEvaluatorId = projectEvaluatorId;
			evaluation.qualificationStatusTypeId = statusTypeId;
			if (observation !== undefined) {
				evaluation.observation = i18nText(observation);
			}
			await manager.save(evaluation);
		} else {
			evaluation = manager.create(EvaluationEntity, {
				projectStudentId: projectStudentId,
				projectEvaluatorId: projectEvaluatorId,
				rubricId: rubricId,
				qualificationStatusTypeId: statusTypeId,
				observation: i18nText(observation),
				registerAt: new Date(),
				isActive: true,
			});
			evaluation = await manager.save(evaluation);
		}

		for (const scoreDto of scores) {
			const existingScore = await manager.findOne(RubricScoreEntity, {
				where: {
					evaluationId: evaluation.id,
					rubricQuestionCriteriaId: scoreDto.rubricQuestionCriteriaId,
				},
			});

			if (existingScore) {
				existingScore.score = scoreDto.score;
				existingScore.commentaries = i18nText(scoreDto.commentaries) ?? existingScore.commentaries;
				await manager.save(existingScore);
			} else {
				const newScore = manager.create(RubricScoreEntity, {
					evaluationId: evaluation.id,
					rubricQuestionCriteriaId: scoreDto.rubricQuestionCriteriaId,
					score: scoreDto.score,
					commentaries: i18nText(scoreDto.commentaries) as any,
					isActive: true,
				});
				await manager.save(newScore);
			}
		}

		return evaluation;
	}

	/**
	 * Submits/updates an individual criteria score.
	 *
	 * Flow:
	 * 1. Validate evaluator/student and ranges
	 * 2. Reject if evaluator is DOC type (view only)
	 * 3. UPSERT into rubric_scores
	 * 4. Write outcome grades directly (no averaging across evaluators)
	 * 5. Persist scaled outcome grades
	 * 6. Return 20-point scale grade
	 */
	async submitEvaluation(
		dto: SubmitEvaluationDto,
	): Promise<{ success: boolean; evaluationId: number; scaledScore?: number }> {
		const evaluator = await this.evaluatorRepo.findOne({
			where: { id: dto.projectEvaluatorId },
			relations: ['project'],
		});
		const student = await this.studentRepo.findOne({
			where: { id: dto.projectStudentId },
			relations: ['project'],
		});

		if (!evaluator || !student) {
			throw new NotFoundException(evaluationsValidationStrings.error.evaluatorOrStudentNotFound);
		}
		if (!evaluator.isActive) {
			throw new BadRequestException(
				evaluationsValidationStrings.error.inactiveEvaluatorCannotGrade,
			);
		}
		if (evaluator.projectId !== student.projectId) {
			throw new ConflictException(evaluationsValidationStrings.error.notSameProject);
		}

		if (!(await this.canEvaluatorTypeGrade(evaluator.evaluatorTypeId))) {
			throw new BadRequestException(evaluationsValidationStrings.error.evaluatorTypeNotAuthorized);
		}

		const criteriaIds = dto.scores.map((s) => s.rubricQuestionCriteriaId);
		const criterias = await this.criteriaRepo.find({ where: { id: In(criteriaIds) } });

		const rubric = await this.rubricRepo.findOne({
			where: { id: dto.rubricId },
			relations: ['questions', 'questions.criterias'],
		});
		if (!rubric) {
			throw new NotFoundException(evaluationsValidationStrings.error.rubricNotFound);
		}

		const statusCode = await this.resolveEvaluatorTypeCode(dto.qualificationStatusTypeId);
		const isNr = statusCode === TYPE_CODES.QUALIFICATION_STATUS.NR;
		const isNa = statusCode === TYPE_CODES.QUALIFICATION_STATUS.NA;
		const isNrOrNa = isNr || isNa;

		const isCapstone = await this.isCapstoneRubric(rubric.rubricTypeId);
		const isMultipleScope = await this.isMultipleCompetencyScope(rubric.competencyScopeTypeId);
		const isCapstoneMultiple = isCapstone && isMultipleScope;

		const criteriaToQuestion = new Map<number, number>();
		for (const question of rubric.questions ?? []) {
			for (const criteria of question.criterias ?? []) {
				criteriaToQuestion.set(criteria.id, question.id);
			}
		}

		if (!isNrOrNa) {
			if (isCapstoneMultiple) {
				// All rubric criteria must be in the DTO
				const allCriteriaIds = new Set(criteriaToQuestion.keys());
				const scoredIds = new Set(dto.scores.map((s) => s.rubricQuestionCriteriaId));
				const missing = [...allCriteriaIds].filter((id) => !scoredIds.has(id));
				if (missing.length > 0) {
					throw new BadRequestException(evaluationsValidationStrings.error.allCriteriaRequired);
				}
			} else {
				// Partial Capstone or non-Capstone: maximum 1 criteria per question
				const countByQuestion = new Map<number, number>();
				for (const scoreDto of dto.scores) {
					const questionId = criteriaToQuestion.get(scoreDto.rubricQuestionCriteriaId);
					if (!questionId) continue;
					countByQuestion.set(questionId, (countByQuestion.get(questionId) ?? 0) + 1);
				}
				for (const count of countByQuestion.values()) {
					if (count > 1) {
						throw new BadRequestException(
							evaluationsValidationStrings.error.oneCriteriaPerQuestion,
						);
					}
				}
			}

			const validPerfLevelValues = isCapstoneMultiple
				? await this.getValidPerformanceLevelValues(rubric)
				: null;

			for (const scoreDto of dto.scores) {
				const criteria = criterias.find((c) => c.id === scoreDto.rubricQuestionCriteriaId);
				if (!criteria) {
					throw new NotFoundException(evaluationsValidationStrings.error.criteriaNotFound);
				}
				if (validPerfLevelValues) {
					if (!validPerfLevelValues.has(Number(scoreDto.score))) {
						throw new BadRequestException(evaluationsValidationStrings.error.invalidScoreCapstone);
					}
				} else {
					if (
						Number(scoreDto.score) < Number(criteria.minValue) ||
						Number(scoreDto.score) > Number(criteria.maxValue)
					) {
						throw new BadRequestException(evaluationsValidationStrings.error.invalidScore);
					}
				}
			}
		}

		const scoresToSave =
			isCapstoneMultiple && isNrOrNa
				? [...criteriaToQuestion.keys()].map((criteriaId) => ({
						rubricQuestionCriteriaId: criteriaId,
						score: 0,
					}))
				: dto.scores;

		const highestPerformanceLevelValue = await this.getHighestPerformanceLevelValue(rubric);

		const { evaluationId, sumScores } = await this.evaluationRepository.runInTransaction(
			async (manager) => {
				const evaluation = await this.saveEvaluationScores(
					manager,
					dto.projectStudentId,
					dto.projectEvaluatorId,
					rubric.id,
					dto.observation,
					scoresToSave,
					dto.qualificationStatusTypeId,
				);

				if (!isCapstoneMultiple) {
					const submittedCriteriaIds = new Set(dto.scores.map((s) => s.rubricQuestionCriteriaId));
					const questionsInSubmission = new Set(
						dto.scores
							.map((s) => criteriaToQuestion.get(s.rubricQuestionCriteriaId))
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
						await manager.delete(RubricScoreEntity, {
							evaluationId: evaluation.id,
							rubricQuestionCriteriaId: In(criteriaToDelete),
						});
					}
				}

				// Any authorized evaluator writes directly on the same evaluation
				// (R-NOT-008/R-NOT-009), without averaging across evaluators.
				const { outcomeGrades: txOutcomeGrades, notaRubrica: sumScores } =
					await this.aggregateScoresByOutcome(manager, evaluation.id, highestPerformanceLevelValue);

				await this.upsertOutcomeGrades(
					manager,
					student.studentSectionEnrollmentId,
					evaluation.id,
					txOutcomeGrades,
				);

				return { evaluationId: evaluation.id, sumScores };
			},
		);

		// Same rule in submit, GET /project/:id and grade export: Capstone + Multiple
		// competency scales against performance levels; the rest simply sums the scores.
		const totalMaxScore = highestPerformanceLevelValue * (rubric.questions?.length ?? 0);
		const scaledScore = isCapstoneMultiple ? this.scaleTo20(sumScores, totalMaxScore) : sumScores;

		return { success: true, evaluationId, scaledScore };
	}

	/**
	 * Saves/updates the observation of an evaluation (R-NOT-014)
	 */
	async saveObservation(dto: SaveObservationDto): Promise<{ success: boolean }> {
		const evaluator = await this.evaluatorRepo.findOne({
			where: { id: dto.projectEvaluatorId },
		});

		if (!evaluator) {
			throw new NotFoundException(evaluationsValidationStrings.error.evaluatorOrStudentNotFound);
		}
		if (!evaluator.isActive) {
			throw new BadRequestException(
				evaluationsValidationStrings.error.inactiveEvaluatorCannotGrade,
			);
		}

		if (!(await this.canEvaluatorTypeGrade(evaluator.evaluatorTypeId))) {
			throw new BadRequestException(evaluationsValidationStrings.error.evaluatorTypeNotAuthorized);
		}

		const asistioStatusTypeId = await this.resolveStatusTypeIdByCode(
			TYPE_CODES.QUALIFICATION_STATUS.ASISTIO,
		);
		const nrStatusTypeId = await this.resolveStatusTypeIdByCode(TYPE_CODES.QUALIFICATION_STATUS.NR);

		await this.evaluationRepository.runInTransaction(async (manager) => {
			let evaluation = await manager.findOne(EvaluationEntity, {
				where: {
					projectStudentId: dto.projectStudentId,
					rubricId: dto.rubricId,
				},
			});

			if (!evaluation) {
				evaluation = manager.create(EvaluationEntity, {
					projectStudentId: dto.projectStudentId,
					projectEvaluatorId: dto.projectEvaluatorId,
					rubricId: dto.rubricId,
					qualificationStatusTypeId: nrStatusTypeId,
					observation: i18nText(dto.observation),
					registerAt: new Date(),
				});
			} else {
				evaluation.projectEvaluatorId = dto.projectEvaluatorId;
				evaluation.observation = i18nText(dto.observation);
			}

			if (!evaluation.observation || !i18nTrim(evaluation.observation)) {
				evaluation.qualificationStatusTypeId = nrStatusTypeId;
			} else {
				evaluation.qualificationStatusTypeId = asistioStatusTypeId;
			}

			await manager.save(evaluation);
		});

		return { success: true };
	}

	/**
	 * Finalizes project grading (R-NOT-011, R-NOT-012, R-NOT-013, R-NOT-015)
	 */
	async finalizeProject(dto: FinalizeProjectDto): Promise<{ success: boolean; message: string }> {
		const evaluator = await this.evaluatorRepo.findOne({
			where: { id: dto.evaluatorId },
		});

		if (!evaluator) {
			throw new NotFoundException(evaluationsValidationStrings.error.evaluatorOrStudentNotFound);
		}
		if (!evaluator.isActive) {
			throw new BadRequestException(
				evaluationsValidationStrings.error.inactiveEvaluatorCannotGrade,
			);
		}

		if (!(await this.canEvaluatorTypeGrade(evaluator.evaluatorTypeId))) {
			throw new BadRequestException(evaluationsValidationStrings.error.evaluatorTypeNotAuthorized);
		}

		const project = await this.projectRepo.findOne({
			where: { id: dto.projectId },
			relations: ['students', 'students.studentSectionEnrollment'],
		});

		if (!project) {
			throw new NotFoundException(evaluationsValidationStrings.error.projectNotFound);
		}

		const { rubrics } = await this.getRubricsForProject(dto.projectId);
		if (rubrics.length === 0) {
			throw new BadRequestException(evaluationsValidationStrings.error.noRubricForProject);
		}

		const asistioStatusTypeId = await this.resolveStatusTypeIdByCode(
			TYPE_CODES.QUALIFICATION_STATUS.ASISTIO,
		);

		await this.evaluationRepository.runInTransaction(async (manager) => {
			for (const ps of project.students) {
				if (!ps.studentSectionEnrollment) continue;

				for (const rubric of rubrics) {
					const totalCriteria =
						rubric.questions?.reduce((sum, q) => sum + (q.criterias?.length || 0), 0) || 0;

					const evaluation = await manager.findOne(EvaluationEntity, {
						where: {
							projectStudentId: ps.id,
							rubricId: rubric.id,
						},
					});

					if (!evaluation) {
						throw new BadRequestException(evaluationsValidationStrings.error.gradeAllStudents);
					}

					if (!dto.isPa && !i18nTrim(evaluation.observation)) {
						throw new BadRequestException(evaluationsValidationStrings.error.observationRequired);
					}

					const criteriaCount = await manager.count(RubricScoreEntity, {
						where: { evaluationId: evaluation.id },
					});

					if (criteriaCount < totalCriteria) {
						throw new BadRequestException(evaluationsValidationStrings.error.allCriteriaRequired);
					}

					evaluation.qualificationStatusTypeId = asistioStatusTypeId;
					await manager.save(evaluation);
				}
			}
		});

		return { success: true, message: evaluationsValidationStrings.result.finalized };
	}

	async getEvaluationById(id: number): Promise<EvaluationEntity> {
		const evaluation = await this.evaluationRepo.findOne({
			where: { id },
			relations: ['scores', 'projectStudent', 'projectEvaluator'],
		});

		if (!evaluation) {
			throw new NotFoundException(evaluationsValidationStrings.error.notFound);
		}

		return evaluation;
	}

	async getStudentEvaluations(studentId: number): Promise<EvaluationEntity[]> {
		return await this.evaluationRepo.find({
			where: { projectStudentId: studentId },
			relations: ['scores', 'projectEvaluator'],
		});
	}

	async getEvaluatorEvaluations(evaluatorId: number): Promise<EvaluationEntity[]> {
		return await this.evaluationRepo.find({
			where: { projectEvaluatorId: evaluatorId },
			relations: ['scores', 'projectStudent'],
		});
	}
}
