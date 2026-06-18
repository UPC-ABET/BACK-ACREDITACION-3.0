import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';
import {
	Injectable,
	NotFoundException,
	BadRequestException,
	Inject,
	forwardRef,
} from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ProjectEntity } from '../model/projects.entity';
import { ProjectStudentEntity } from 'src/modules/evaluation/project-students/model/project-students.entity';
import { ProjectEvaluatorEntity } from 'src/modules/evaluation/project-evaluators/model/project-evaluators.entity';
import {
	CreateProjectDto,
	GetProjectsByProfessorQueryDto,
	ProjectEvaluatorResponseDto,
	ProjectDetailsResponseDto,
	ProjectRubricEntryDto,
} from '../model/projects.dtos';
import { PaginatedResult, resolvePagination, toPaginated } from 'src/commons/pagination.dtos';
import { TypeEntity } from 'src/modules/core/types/model/types.entity';
import { RubricConfigService } from 'src/modules/evaluation/rubrics/api/rubric-config.service';
import { projectsValidationStrings } from '../config/strings/projects.validation';
import { EvaluationEntity } from 'src/modules/evidence/evaluations/model/evaluations.entity';
import { RubricEntity } from 'src/modules/evaluation/rubrics/model/rubrics.entity';
import { RubricQuestionCriteriaEntity } from '../../rubric-question-criterias/model/rubric-question-criterias.entity';
import { RubricQuestionEntity } from '../../rubric-questions/model/rubric-questions.entity';
import { StudyPlanCourseEntity } from 'src/modules/academic/study-plan-courses/model/study-plan-courses.entity';
import { StudentSectionEnrollmentEntity } from 'src/modules/academic/student-section-enrollments/model/student-section-enrollments.entity';

@Injectable()
export class ProjectConfigService {
	constructor(
		@InjectRepository(ProjectEntity)
		private readonly projectRepo: Repository<ProjectEntity>,
		@InjectRepository(ProjectStudentEntity)
		private readonly projectStudentRepo: Repository<ProjectStudentEntity>,
		@InjectRepository(ProjectEvaluatorEntity)
		private readonly projectEvaluatorRepo: Repository<ProjectEvaluatorEntity>,
		@InjectRepository(TypeEntity)
		private readonly typeRepo: Repository<TypeEntity>,
		@InjectRepository(StudyPlanCourseEntity)
		private readonly studyPlanCourseRepo: Repository<StudyPlanCourseEntity>,
		@InjectRepository(StudentSectionEnrollmentEntity)
		private readonly enrollmentRepo: Repository<StudentSectionEnrollmentEntity>,
		@Inject(forwardRef(() => RubricConfigService))
		private readonly rubricConfigService: RubricConfigService,
		private readonly dataSource: DataSource,
	) {}

	private async resolveGradeTypeIdByCode(code: string): Promise<number> {
		const type = await this.typeRepo.findOne({ where: { code } });
		if (!type) {
			throw new BadRequestException(projectsValidationStrings.error.invalidGradeTypeCode);
		}
		return type.id;
	}

	private async resolveCapstoneMaxScore(
		academicPeriodId: number,
		rubricId: number,
	): Promise<number> {
		const [[levelRow], [questionRow]] = await Promise.all([
			this.dataSource.query(
				`SELECT MAX(pl.max_value) AS "maxValue"
				 FROM academic.performance_levels pl
				 INNER JOIN core.types t ON t.id = pl.instrument_type_id
				 WHERE t.code = $1
				   AND pl.academic_period_id = $2`,
				[TYPE_CODES.PERF_LEVEL_INSTRUMENT.TYPE, academicPeriodId],
			),
			this.dataSource.query(
				`SELECT COUNT(*) AS "questionCount"
				 FROM evaluation.rubric_questions
				 WHERE rubric_id = $1`,
				[rubricId],
			),
		]);
		const maxPerQuestion = Number(levelRow?.maxValue ?? 0);
		const questionCount = Number(questionRow?.questionCount ?? 0);
		return maxPerQuestion * questionCount;
	}

	private async resolveProgramIdsBySchoolId(schoolId: number): Promise<number[]> {
		const raw = await this.dataSource.query(
			`
				SELECT DISTINCT c_child.entity_code AS "programId"
				FROM organization.charts c_school
				INNER JOIN organization.charts c_child 
				ON c_child.root_chart_id = c_school.id
				WHERE c_school.entity_type_id = (SELECT id FROM core.types WHERE code = $1)
				AND c_school.entity_code = $2
				AND c_child.entity_type_id = (SELECT id FROM core.types WHERE code = $3)
				AND c_child.entity_code IS NOT NULL
			`,
			[TYPE_CODES.ENTITY_TYPE.SCHOOL, schoolId, TYPE_CODES.ENTITY_TYPE.PROGRAM],
		);
		return raw.map((row: { programId: number }) => row.programId);
	}

	/**
	 * Crea un proyecto completo con sus estudiantes y evaluadores de forma transaccional.
	 *
	 * Validaciones previas:
	 * - study_plan_course debe existir y tener extra.is_evaluable = true
	 * - código y nombre únicos en el mismo periodo académico
	 * - alumnos activos, matriculados en el curso, sin proyecto en el mismo periodo
	 * - evaluadores sin duplicados de profesor+tipo, con límites por tipo
	 */
	async createProject(dto: CreateProjectDto): Promise<ProjectEntity> {
		const studyPlanCourse = await this.studyPlanCourseRepo.findOne({
			where: { id: dto.studyPlanCourseId },
			relations: ['studyPlanAcademicPeriod'],
		});

		if (!studyPlanCourse) {
			throw new NotFoundException({
				message: projectsValidationStrings.error.notFound,
				errors: [`studyPlanCourseId ${dto.studyPlanCourseId}`],
			});
		}

		if (studyPlanCourse.extra?.is_evaluable !== true) {
			throw new BadRequestException(projectsValidationStrings.error.notEvaluateRubric);
		}

		const academicPeriodId = studyPlanCourse.studyPlanAcademicPeriod?.academicPeriodId;
		if (!academicPeriodId) {
			throw new BadRequestException(projectsValidationStrings.error.noAcademicPeriod);
		}

		const duplicateCode = await this.dataSource.query(
			`
			SELECT p.id FROM evaluation.projects p
			INNER JOIN evaluation.project_students ps ON ps.project_id = p.id
			INNER JOIN academic.student_section_enrollments sse ON sse.id = ps.student_section_enrollment_id
			INNER JOIN academic.course_sections cs ON cs.id = sse.course_section_id
			WHERE p.code = $1 AND cs.academic_period_id = $2
			LIMIT 1
			`,
			[dto.code, academicPeriodId],
		);
		if (duplicateCode.length > 0) {
			throw new BadRequestException(projectsValidationStrings.error.duplicateCode);
		}

		const duplicateName = await this.dataSource.query(
			`
			SELECT p.id FROM evaluation.projects p
			INNER JOIN evaluation.project_students ps ON ps.project_id = p.id
			INNER JOIN academic.student_section_enrollments sse ON sse.id = ps.student_section_enrollment_id
			INNER JOIN academic.course_sections cs ON cs.id = sse.course_section_id
			WHERE (p.name->>'es' = $1 OR p.name->>'en' = $2) AND cs.academic_period_id = $3
			LIMIT 1
			`,
			[dto.name?.es, dto.name?.en, academicPeriodId],
		);
		if (duplicateName.length > 0) {
			throw new BadRequestException(projectsValidationStrings.error.duplicateName);
		}

		if (!dto.studentSectionEnrollmentIds?.length) {
			throw new BadRequestException(projectsValidationStrings.error.noStudents);
		}

		const enrollments = await this.enrollmentRepo.find({
			where: dto.studentSectionEnrollmentIds.map((id) => ({ id })),
			relations: ['courseSection'],
		});

		for (const enrollmentId of dto.studentSectionEnrollmentIds) {
			const enrollment = enrollments.find((e) => e.id === enrollmentId);

			if (!enrollment) {
				throw new NotFoundException({
					message: projectsValidationStrings.error.enrollmentNotFound,
					errors: [String(enrollmentId)],
				});
			}

			if (!enrollment.isActive) {
				throw new BadRequestException({
					message: projectsValidationStrings.error.studentWithdrawn,
					errors: [String(enrollmentId)],
				});
			}

			if (
				enrollment.courseSection?.courseId !== studyPlanCourse.courseId ||
				enrollment.courseSection?.academicPeriodId !== academicPeriodId
			) {
				throw new BadRequestException({
					message: projectsValidationStrings.error.studentNotInCourse,
					errors: [String(enrollmentId)],
				});
			}

			const alreadyInProject = await this.dataSource.query(
				`
				SELECT ps.id FROM evaluation.project_students ps
				INNER JOIN evaluation.projects p ON p.id = ps.project_id
				INNER JOIN academic.student_section_enrollments sse ON sse.id = ps.student_section_enrollment_id
				INNER JOIN academic.course_sections cs ON cs.id = sse.course_section_id
				WHERE sse.enrolled_student_id = (
					SELECT enrolled_student_id FROM academic.student_section_enrollments WHERE id = $1
				)
				AND cs.academic_period_id = $2
				AND p.is_active = true
				LIMIT 1
				`,
				[enrollmentId, academicPeriodId],
			);
			if (alreadyInProject.length > 0) {
				throw new BadRequestException({
					message: projectsValidationStrings.error.studentAlreadyInProject,
					errors: [String(enrollmentId)],
				});
			}
		}

		if (!dto.evaluators?.length) {
			throw new BadRequestException(projectsValidationStrings.error.noEvaluators);
		}

		const typeCountInRequest = new Map<number, number>();
		for (const ev of dto.evaluators) {
			typeCountInRequest.set(
				ev.evaluatorTypeId,
				(typeCountInRequest.get(ev.evaluatorTypeId) ?? 0) + 1,
			);
		}

		for (const [typeId, count] of typeCountInRequest.entries()) {
			if (count > 1) {
				throw new BadRequestException(projectsValidationStrings.error.evaluatorLimit);
			}
		}

		return await this.dataSource.transaction(async (manager) => {
			const project = manager.create(ProjectEntity, {
				code: dto.code,
				name: dto.name,
				description: dto.description,
				isActive: dto.isActive ?? true,
				extra: dto.extra,
			});

			const savedProject = await manager.save(project);

			const projectStudents = dto.studentSectionEnrollmentIds.map((enrollmentId) =>
				manager.create(ProjectStudentEntity, {
					projectId: savedProject.id,
					studentSectionEnrollmentId: enrollmentId,
					isActive: true,
				}),
			);
			await manager.save(projectStudents);

			const projectEvaluators = dto.evaluators.map((ev) =>
				manager.create(ProjectEvaluatorEntity, {
					projectId: savedProject.id,
					professorId: ev.professorId,
					evaluatorTypeId: ev.evaluatorTypeId,
					isActive: true,
				}),
			);
			await manager.save(projectEvaluators);

			return savedProject;
		});
	}

	async getProjectWithDetails(
		projectId: number,
		isEvaluationMode: boolean,
		gradeTypeCode?: string,
		rubricTypeId?: number,
	): Promise<ProjectDetailsResponseDto> {
		const gradeTypeId = gradeTypeCode
			? await this.resolveGradeTypeIdByCode(gradeTypeCode)
			: undefined;

		const project = await this.projectRepo
			.createQueryBuilder('p')
			.leftJoinAndSelect('p.students', 's')
			.leftJoinAndSelect('s.studentSectionEnrollment', 'sse')
			.leftJoinAndSelect('sse.enrolledStudent', 'es')
			.leftJoinAndSelect('es.student', 'stu')
			.leftJoinAndSelect('sse.courseSection', 'cs')
			.leftJoinAndSelect('cs.academicPeriod', 'ap')
			.leftJoinAndSelect('p.evaluators', 'pe', 'pe.is_active = true')
			.leftJoinAndSelect('pe.professor', 'prof')
			.leftJoinAndSelect('prof.staff', 'staff')
			.leftJoinAndSelect('staff.user', 'puser')
			.where('p.id = :projectId', { projectId })
			.getOne();

		if (!project) {
			throw new NotFoundException(projectsValidationStrings.error.notFound);
		}

		const studentWithChain = project.students?.find(
			(s) => s.studentSectionEnrollment?.courseSection?.courseId != null,
		);

		const courseSection = studentWithChain?.studentSectionEnrollment?.courseSection;
		const courseId = courseSection?.courseId;
		const sectionAcademicPeriodId = courseSection?.academicPeriodId;

		if (!courseId || !sectionAcademicPeriodId) {
			throw new BadRequestException(projectsValidationStrings.error.noStudentsWithCourse);
		}

		const academicPeriod = courseSection?.academicPeriod;

		const [courseRow] = await this.dataSource.query(
			`SELECT id, name, description, learning_outcome AS "learningOutcome"
			 FROM "academic"."courses" WHERE id = $1`,
			[courseId],
		);
		const courseData = courseRow
			? {
					id: courseRow.id,
					name: courseRow.name,
					description: courseRow.description,
					learningOutcome: courseRow.learningOutcome,
				}
			: null;

		// Resolve study_plan_course_id per student via their enrolled_student → study_plan_academic_period
		const spcRows = (await this.dataSource.query(
			`SELECT
				sse.id AS "sseId",
				spc.id AS "studyPlanCourseId"
			 FROM academic.student_section_enrollments sse
			 JOIN academic.enrolled_students es ON es.id = sse.enrolled_student_id
			 JOIN academic.study_plan_courses spc
			      ON spc.study_plan_academic_period_id = es.study_plan_academic_period
			      AND spc.course_id = $1
			 WHERE sse.id = ANY($2::int[])`,
			[
				courseId,
				(project.students || [])
					.map((s) => s.studentSectionEnrollment?.id)
					.filter((id) => id != null),
			],
		)) as { sseId: number; studyPlanCourseId: number }[];

		const sseToSpc = new Map<number, number>(spcRows.map((r) => [r.sseId, r.studyPlanCourseId]));

		// Unique study_plan_course_ids across all students
		const uniqueSpcIds = [...new Set(spcRows.map((r) => r.studyPlanCourseId))];

		// Resolve program name per study_plan_course_id
		const programRows = (await this.dataSource.query(
			`SELECT spc.id AS "spcId", prog.name AS "programName"
			 FROM academic.study_plan_courses spc
			 JOIN academic.study_plan_academic_periods spap ON spap.id = spc.study_plan_academic_period_id
			 JOIN academic.study_plans sp ON sp.id = spap.study_plan_id
			 JOIN academic.programs prog ON prog.id = sp.program_id
			 WHERE spc.id = ANY($1::int[])`,
			[uniqueSpcIds],
		)) as { spcId: number; programName: any }[];

		const spcToProgramName = new Map<number, any>(programRows.map((r) => [r.spcId, r.programName]));

		// Fetch rubric per study_plan_course_id
		const rubricEntries: ProjectRubricEntryDto[] = [];

		for (const spcId of uniqueSpcIds) {
			const rubric = await this.dataSource
				.getRepository(RubricEntity)
				.createQueryBuilder('r')
				.leftJoinAndSelect('r.rubricType', 'rt')
				.leftJoinAndSelect('r.gradeType', 'gt')
				.where('r.study_plan_course_id = :spcId', { spcId })
				.andWhere('r.is_active = :isActive', { isActive: true })
				.andWhere(gradeTypeId ? 'r.grade_type_id = :gradeTypeId' : '1=1', { gradeTypeId })
				.andWhere(rubricTypeId ? 'r.rubric_type_id = :rubricTypeId' : '1=1', { rubricTypeId })
				.getOne();

			if (!rubric) {
				rubricEntries.push({
					studyPlanCourseId: spcId,
					programName: spcToProgramName.get(spcId) ?? null,
					rubric: null,
					commissions: [],
					outcomes: [],
					questions: [],
				});
				continue;
			}

			const rubricContext = await this.rubricConfigService
				.getRubricWithContextData(rubric.id)
				.catch(() => null);

			let evaluations: EvaluationEntity[] = [];

			if (isEvaluationMode) {
				const isCapstoneEb =
					rubric.rubricType?.code === TYPE_CODES.RUBRIC_TYPE.CAPSTONE &&
					gradeTypeCode === TYPE_CODES.GRADE_TYPE.EB;

				// Only load evaluations for students that belong to this spcId
				const studentsForSpc = (project.students || []).filter(
					(s) => sseToSpc.get(s.studentSectionEnrollment?.id!) === spcId,
				);
				const psIdsForSpc = studentsForSpc.map((s) => s.id);

				if (psIdsForSpc.length > 0) {
					const totalMaxScore = isCapstoneEb
						? await this.resolveCapstoneMaxScore(sectionAcademicPeriodId, rubric.id)
						: (
								await this.rubricConfigService
									.recalculateMaxScore(rubric.id)
									.catch(() => ({ totalMaxScore: 0 }))
							).totalMaxScore || 0;

					evaluations = await this.dataSource
						.getRepository(EvaluationEntity)
						.createQueryBuilder('ev')
						.leftJoinAndSelect('ev.scores', 'score')
						.innerJoin('ev.projectStudent', 'ps')
						.innerJoin(
							RubricQuestionCriteriaEntity,
							'rqc',
							'rqc.id = score.rubric_question_criteria_id',
						)
						.innerJoin(RubricQuestionEntity, 'rq', 'rq.id = rqc.rubric_question_id')
						.where('ps.project_id = :projectId', { projectId })
						.andWhere('ps.id = ANY(:psIds)', { psIds: psIdsForSpc })
						.andWhere('rq.rubric_id = :rubricId', { rubricId: rubric.id })
						.getMany();

					// Attach totalGrade to students of this spc
					for (const s of studentsForSpc) {
						const evals = evaluations.filter((ev) => ev.projectStudentId === s.id);
						if (evals.length > 0) {
							const sumScores = evals.reduce((sum, ev) => {
								return (
									sum + (ev.scores || []).reduce((sSum, score) => sSum + Number(score.score), 0)
								);
							}, 0);
							(s as any).__totalGrade = isCapstoneEb
								? this.computeGrade(sumScores, totalMaxScore)
								: sumScores;
							(s as any).__evaluationStatuses = evals.map((ev) => ({
								evaluatorId: ev.projectEvaluatorId,
								qualificationStatusTypeId: ev.qualificationStatusTypeId,
							}));
						}
					}
				}
			}

			const questions = (rubricContext?.questions || []).map((q: any) => ({
				id: q.id,
				text: q.text,
				outcomeId: q.outcomeId,
				criterias: (q.criterias || []).map((c: any) => {
					let criteriaScores: any[] | null = null;
					if (isEvaluationMode) {
						criteriaScores = [];
						evaluations.forEach((ev) => {
							const scoreObj = (ev.scores || []).find((sc) => sc.rubricQuestionCriteriaId === c.id);
							if (scoreObj) {
								criteriaScores!.push({
									studentId: ev.projectStudentId,
									evaluatorId: ev.projectEvaluatorId,
									score: Number(scoreObj.score),
									commentaries: scoreObj.commentaries || '',
								});
							}
						});
					}
					return {
						id: c.id,
						text: c.text,
						minValue: c.minValue,
						maxValue: c.maxValue,
						scores: criteriaScores,
					};
				}),
			}));

			rubricEntries.push({
				studyPlanCourseId: spcId,
				programName: spcToProgramName.get(spcId) ?? null,
				rubric: rubricContext?.rubric ?? null,
				commissions: rubricContext?.commissions ?? [],
				outcomes: rubricContext?.outcomes ?? [],
				questions,
			});
		}

		const studentDtos = (project.students || []).map((s) => {
			const stu = s.studentSectionEnrollment?.enrolledStudent?.student;
			const sseId = s.studentSectionEnrollment?.id;
			return {
				id: s.id,
				studentId: s.studentSectionEnrollment?.enrolledStudent?.studentId || 0,
				firstName: stu?.firstName || '',
				lastName: stu?.lastName || '',
				email: stu?.email || '',
				studentCode: stu?.code || '',
				studyPlanCourseId: sseId != null ? (sseToSpc.get(sseId) ?? null) : null,
				totalGrade: isEvaluationMode ? ((s as any).__totalGrade ?? null) : null,
				evaluations: isEvaluationMode ? ((s as any).__evaluationStatuses ?? []) : [],
			};
		});

		const evaluatorTypeIds = [...new Set((project.evaluators || []).map((e) => e.evaluatorTypeId))];
		const evaluatorTypesMap = new Map<number, any>();

		if (evaluatorTypeIds.length > 0) {
			const types = await this.typeRepo.findByIds(evaluatorTypeIds);
			types.forEach((t) => evaluatorTypesMap.set(t.id, t));
		}

		const evaluatorDtos = (project.evaluators || []).map((e) => {
			const staff = e.professor?.staff;
			const professorUser = staff?.user;
			const evaluatorType = evaluatorTypesMap.get(e.evaluatorTypeId);

			return {
				id: e.id,
				professorId: e.professorId,
				professorCode: e.professor?.code || '',
				professorFirstName: professorUser?.firstName || staff?.firstName || '',
				professorLastName: professorUser?.lastName || staff?.lastName || '',
				professorEmail: professorUser?.email || '',
				evaluatorTypeId: e.evaluatorTypeId,
				evaluatorTypeName: evaluatorType?.name || '',
				evaluatorTypeCode: evaluatorType?.code || '',
				canEvaluate: evaluatorType?.extra?.can_evaluate === true,
				maxEvaluators: evaluatorType?.extra?.max_evaluators ?? null,
			};
		});

		return {
			project: {
				id: project.id,
				code: project.code || '',
				name: project.name,
				description: project.description || { es: '', en: '' },
			},
			academicPeriod: {
				id: academicPeriod?.id,
				modalityTypeId: academicPeriod?.modalityTypeId,
				code: academicPeriod?.code,
			},
			students: studentDtos,
			evaluators: evaluatorDtos,
			course: courseData,
			rubrics: rubricEntries,
		};
	}

	async getProjectsByProfessor(
		professorId: number,
		academicPeriodId?: number,
		schoolId?: number,
		query?: GetProjectsByProfessorQueryDto,
	): Promise<PaginatedResult<ProjectEvaluatorResponseDto>> {
		const { page, pageSize, skip, take } = resolvePagination(query ?? {});
		const search = query?.search?.trim() || undefined;
		const gradeTypeCode = query?.gradeTypeCode;

		const gradeTypeId = gradeTypeCode
			? await this.resolveGradeTypeIdByCode(gradeTypeCode)
			: undefined;

		// Base FROM/WHERE shared between count and paginated queries
		let filterFromWhere = `
    FROM evaluation.project_evaluators pe
    INNER JOIN evaluation.projects p_filter ON p_filter.id = pe.project_id
    INNER JOIN evaluation.project_students ps ON ps.project_id = pe.project_id
    INNER JOIN academic.student_section_enrollments sse ON sse.id = ps.student_section_enrollment_id
    INNER JOIN academic.course_sections cs ON cs.id = sse.course_section_id
    INNER JOIN academic.courses c ON c.id = cs.course_id
    INNER JOIN academic.study_plan_courses spc ON spc.course_id = c.id
    INNER JOIN academic.study_plan_academic_periods sp_ap ON sp_ap.id = spc.study_plan_academic_period_id
    INNER JOIN academic.study_plans sp ON sp.id = sp_ap.study_plan_id
    INNER JOIN academic.programs program ON program.id = sp.program_id`;

		if (search) {
			filterFromWhere += `
    INNER JOIN academic.enrolled_students es_s ON es_s.id = sse.enrolled_student_id
    INNER JOIN academic.students stu_s ON stu_s.id = es_s.student_id`;
		}

		filterFromWhere += `
    WHERE pe.professor_id = $1 AND pe.is_active = true`;

		const params: any[] = [professorId];
		let paramIdx = 2;

		if (gradeTypeId) {
			filterFromWhere += `
      AND EXISTS (
        SELECT 1
        FROM evaluation.rubrics r
        WHERE r.study_plan_course_id IN (
          SELECT spc2.id
          FROM academic.study_plan_courses spc2
          INNER JOIN academic.study_plan_academic_periods spap2
                  ON spap2.id = spc2.study_plan_academic_period_id
          WHERE (spc2.course_id, spap2.academic_period_id) IN (
            SELECT cs2.course_id, cs2.academic_period_id
            FROM evaluation.project_students ps2
            INNER JOIN academic.student_section_enrollments sse2
                    ON sse2.id = ps2.student_section_enrollment_id
            INNER JOIN academic.course_sections cs2
                    ON cs2.id = sse2.course_section_id
            WHERE ps2.project_id = pe.project_id
          )
        )
        AND r.grade_type_id = $${paramIdx}
      )`;
			params.push(gradeTypeId);
			paramIdx++;
		}

		if (academicPeriodId) {
			filterFromWhere += ` AND cs.academic_period_id = $${paramIdx}`;
			params.push(academicPeriodId);
			paramIdx++;
		}

		const programIds = schoolId ? await this.resolveProgramIdsBySchoolId(schoolId) : null;

		if (programIds !== null) {
			if (programIds.length === 0) return toPaginated([], 0, page, pageSize);
			filterFromWhere += ` AND program.id = ANY($${paramIdx}::int[])`;
			params.push(programIds);
			paramIdx++;
		}

		if (search) {
			filterFromWhere += `
      AND (
        p_filter.code ILIKE $${paramIdx}
        OR p_filter.name->>'es' ILIKE $${paramIdx}
        OR p_filter.name->>'en' ILIKE $${paramIdx}
        OR CONCAT(stu_s.first_name, ' ', stu_s.last_name) ILIKE $${paramIdx}
      )`;
			params.push(`%${search}%`);
			paramIdx++;
		}

		const [countRow] = (await this.dataSource.query(
			`SELECT COUNT(DISTINCT pe.project_id) AS "total" ${filterFromWhere}`,
			params,
		)) as [{ total: string }];
		const total = Number(countRow?.total ?? 0);

		if (total === 0) return toPaginated([], 0, page, pageSize);

		const rows = (await this.dataSource.query(
			`SELECT DISTINCT pe.project_id AS "projectId" ${filterFromWhere} ORDER BY pe.project_id LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
			[...params, take, skip],
		)) as { projectId: number }[];

		const projectIds = rows.map((r) => r.projectId);
		if (projectIds.length === 0) return toPaginated([], total, page, pageSize);

		// Todo en SQL nativo para evitar el producto cartesiano
		const raw = (await this.dataSource.query(
			`
    SELECT
      p.id              AS "projectId",
      p.code            AS "projectCode",
      p.name            AS "projectName",
      (
        SELECT MAX(ev.register_at)
        FROM evidence.evaluations ev
        INNER JOIN evaluation.project_students ev_ps ON ev_ps.id = ev.project_student_id
        INNER JOIN evaluation.rubric_scores rs ON rs.evaluation_id = ev.id
        INNER JOIN evaluation.rubric_question_criterias rqc ON rqc.id = rs.rubric_question_criteria_id
        INNER JOIN evaluation.rubric_questions rq ON rq.id = rqc.rubric_question_id
        INNER JOIN evaluation.rubrics r ON r.id = rq.rubric_id
        WHERE ev_ps.project_id = p.id
        AND ($2::int IS NULL OR r.grade_type_id = $2)
      )                 AS "evaluationDate",
      -- evaluadores
      all_pe.id         AS "evalId",
      all_pe.professor_id AS "evalProfessorId",
      COALESCE(all_u.first_name, all_st.first_name, '') AS "evalFirstName",
      COALESCE(all_u.last_name, all_st.last_name, '')   AS "evalLastName",
      all_u.email       AS "evalEmail",
      all_et.name       AS "evalTypeName",
      all_et.code       AS "evalTypeCode",
      -- estudiantes
      ps.id             AS "studentPsId",
      stu.id            AS "studentId",
      COALESCE(stu.first_name, '') AS "stuFirstName",
      COALESCE(stu.last_name, '')  AS "stuLastName",
      stu.email         AS "stuEmail",
      COALESCE(stu.code, '') AS "stuCode",
      -- curso
      c.name            AS "courseName"
    FROM evaluation.projects p
    LEFT JOIN evaluation.project_evaluators all_pe ON all_pe.project_id = p.id AND all_pe.is_active = true
    LEFT JOIN academic.professors all_prof         ON all_prof.id = all_pe.professor_id
    LEFT JOIN organization.staff all_st            ON all_st.id = all_prof.staff_id
    LEFT JOIN organization.users all_u             ON all_u.id = all_st.user_id
    LEFT JOIN core.types all_et                    ON all_et.id = all_pe.evaluator_type_id
    LEFT JOIN evaluation.project_students ps       ON ps.project_id = p.id
    LEFT JOIN academic.student_section_enrollments sse ON sse.id = ps.student_section_enrollment_id
    LEFT JOIN academic.enrolled_students es        ON es.id = sse.enrolled_student_id
    LEFT JOIN academic.students stu                ON stu.id = es.student_id
    LEFT JOIN academic.course_sections cs          ON cs.id = sse.course_section_id
    LEFT JOIN academic.courses c                   ON c.id = cs.course_id
    WHERE p.id = ANY($1::int[])
  `,
			[projectIds, gradeTypeId ?? null],
		)) as any[];

		const projectMap = new Map<number, ProjectEvaluatorResponseDto>();

		for (const row of raw) {
			if (!projectMap.has(row.projectId)) {
				const courseName = row.courseName;
				const resolvedCourseName =
					typeof courseName === 'string' ? courseName : courseName?.es || courseName?.en || '';

				projectMap.set(row.projectId, {
					projectId: row.projectId,
					projectCode: row.projectCode || '',
					projectName: row.projectName,
					evaluationDate: row.evaluationDate,
					courseName: resolvedCourseName,
					evaluators: [],
					students: [],
				} as any);
			}

			const project = projectMap.get(row.projectId)!;

			if (row.evalId && !(project.evaluators as any[]).find((e: any) => e.id === row.evalId)) {
				(project.evaluators as any[]).push({
					id: row.evalId,
					professorId: row.evalProfessorId,
					firstName: row.evalFirstName || '',
					lastName: row.evalLastName || '',
					email: row.evalEmail || '',
					evaluatorType: row.evalTypeName || '',
					evaluatorTypeCode: row.evalTypeCode || '',
				});
			}

			if (
				row.studentPsId &&
				!(project.students as any[]).find((s: any) => s.id === row.studentPsId)
			) {
				(project.students as any[]).push({
					id: row.studentPsId,
					studentId: row.studentId || 0,
					firstName: row.stuFirstName || '',
					lastName: row.stuLastName || '',
					email: row.stuEmail || '',
					studentCode: row.stuCode ? String(row.stuCode) : '',
				});
			}
		}

		return toPaginated(Array.from(projectMap.values()), total, page, pageSize);
	}

	async exportProjectGrades(
		academicPeriodId: number,
		schoolId: number,
		gradeTypeCode: string,
	): Promise<Buffer> {
		const gradeTypeId = await this.resolveGradeTypeIdByCode(gradeTypeCode);

		const programIds = await this.resolveProgramIdsBySchoolId(schoolId);
		if (programIds.length === 0) return this.buildGradesExcel([]);

		const rows = (await this.dataSource.query(
			`
      SELECT
        cs.section_code                           AS "sectionCode",
        c.code                                    AS "courseCode",
        stu.code                                  AS "studentCode",
        CONCAT(stu.first_name, ' ', stu.last_name) AS "studentName",
        r.id                                      AS "rubricId",
        r.rubric_type_id                          AS "rubricTypeId",
        rt.code                                   AS "rubricTypeCode",
        gt.code                                   AS "gradeTypeCode",
        SUM(rs.score)                             AS "totalScore"
      FROM evaluation.projects p
      INNER JOIN evaluation.project_students ps       ON ps.project_id = p.id
      INNER JOIN evidence.evaluations ev              ON ev.project_student_id = ps.id
      INNER JOIN evaluation.rubric_scores rs          ON rs.evaluation_id = ev.id
      INNER JOIN evaluation.rubric_question_criterias rqc ON rqc.id = rs.rubric_question_criteria_id
      INNER JOIN evaluation.rubric_questions rq       ON rq.id = rqc.rubric_question_id
      INNER JOIN evaluation.rubrics r                 ON r.id = rq.rubric_id
      INNER JOIN core.types rt                        ON rt.id = r.rubric_type_id
      INNER JOIN core.types gt                        ON gt.id = r.grade_type_id
      INNER JOIN academic.student_section_enrollments sse ON sse.id = ps.student_section_enrollment_id
      INNER JOIN academic.course_sections cs          ON cs.id = sse.course_section_id
      INNER JOIN academic.courses c                   ON c.id = cs.course_id
      INNER JOIN academic.enrolled_students es        ON es.id = sse.enrolled_student_id
      INNER JOIN academic.students stu                ON stu.id = es.student_id
      INNER JOIN academic.study_plan_courses spc      ON spc.course_id = c.id
      INNER JOIN academic.study_plan_academic_periods sp_ap ON sp_ap.id = spc.study_plan_academic_period_id
      INNER JOIN academic.study_plans sp              ON sp.id = sp_ap.study_plan_id
      WHERE cs.academic_period_id = $1
        AND r.grade_type_id = $2
        AND sp.program_id = ANY($3::int[])
      GROUP BY
        cs.section_code, c.code, stu.code, stu.first_name, stu.last_name,
        r.id, r.rubric_type_id, rt.code, gt.code
      ORDER BY c.code, cs.section_code, stu.last_name, stu.first_name
      `,
			[academicPeriodId, gradeTypeId, programIds],
		)) as GradeExportRow[];

		const isCapstoneEbExport = gradeTypeCode === TYPE_CODES.GRADE_TYPE.EB;

		const rubricIds = [...new Set(rows.map((r) => r.rubricId))];
		const maxScoreByRubricId = new Map<number, number>();
		await Promise.all(
			rubricIds.map(async (rubricId) => {
				if (isCapstoneEbExport) {
					const max = await this.resolveCapstoneMaxScore(academicPeriodId, rubricId);
					maxScoreByRubricId.set(rubricId, max);
				} else {
					const data = await this.rubricConfigService
						.recalculateMaxScore(rubricId)
						.catch(() => ({ totalMaxScore: 0 }));
					maxScoreByRubricId.set(rubricId, data.totalMaxScore || 0);
				}
			}),
		);

		const graded = rows.map((row) => ({
			...row,
			grade: this.calculateGrade(row, maxScoreByRubricId.get(row.rubricId) ?? 0),
		}));

		return this.buildGradesExcel(graded);
	}

	private computeGrade(sumScores: number, totalMaxScore: number): number {
		if (totalMaxScore > 0) {
			return Math.round(((sumScores * 20) / totalMaxScore) * 100) / 100;
		}
		return 0;
	}

	private calculateGrade(row: GradeExportRow, totalMaxScore: number): number {
		const isCapstoneAndEb =
			row.rubricTypeCode === TYPE_CODES.RUBRIC_TYPE.CAPSTONE &&
			row.gradeTypeCode === TYPE_CODES.GRADE_TYPE.EB;

		const sumScores = Number(row.totalScore);

		if (isCapstoneAndEb) {
			return this.computeGrade(sumScores, totalMaxScore);
		}

		return sumScores;
	}

	private async buildGradesExcel(rows: (GradeExportRow & { grade: number })[]): Promise<Buffer> {
		const wb = new ExcelJS.Workbook();
		const ws = wb.addWorksheet('Notas');

		const HEADERS = [
			'Código de curso',
			'Código de sección',
			'Código de alumno',
			'Nombre del alumno',
			'Nota',
		];

		ws.columns = [
			{ key: 'courseCode', width: 20 },
			{ key: 'sectionCode', width: 20 },
			{ key: 'studentCode', width: 20 },
			{ key: 'studentName', width: 36 },
			{ key: 'grade', width: 12 },
		];

		const headerRow = ws.getRow(1);
		HEADERS.forEach((h, i) => {
			const cell = headerRow.getCell(i + 1);
			cell.value = h;
			cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCC0000' } };
			cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
			cell.alignment = { vertical: 'middle', horizontal: 'center' };
			cell.border = {
				top: { style: 'thin' },
				left: { style: 'thin' },
				right: { style: 'thin' },
				bottom: { style: 'thin' },
			};
		});
		headerRow.height = 22;

		for (const row of rows) {
			ws.addRow([row.courseCode, row.sectionCode, row.studentCode, row.studentName, row.grade]);
		}

		ws.views = [{ state: 'frozen', ySplit: 1 }];

		return Buffer.from(await wb.xlsx.writeBuffer());
	}
}

interface GradeExportRow {
	sectionCode: string;
	courseCode: string;
	studentCode: string;
	studentName: string;
	rubricId: number;
	rubricTypeId: number;
	rubricTypeCode: string;
	gradeTypeCode: string;
	totalScore: string;
}
