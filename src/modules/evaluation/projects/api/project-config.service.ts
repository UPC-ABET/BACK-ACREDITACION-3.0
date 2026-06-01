import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';
import {
	Injectable,
	NotFoundException,
	BadRequestException,
	Inject,
	forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ProjectEntity } from '../model/projects.entity';
import { ProjectStudentEntity } from 'src/modules/evaluation/project-students/model/project-students.entity';
import { ProjectEvaluatorEntity } from 'src/modules/evaluation/project-evaluators/model/project-evaluators.entity';
import {
	CreateProjectDto,
	ProjectEvaluatorResponseDto,
	ProjectDetailsResponseDto,
} from '../model/projects.dtos';
import { TypeEntity } from 'src/modules/core/types/model/types.entity';
import { RubricConfigService } from 'src/modules/evaluation/rubrics/api/rubric-config.service';
import { projectsValidationStrings } from '../config/strings/projects.validation';
import { EvaluationEntity } from 'src/modules/evidence/evaluations/model/evaluations.entity';
import { RubricEntity } from 'src/modules/evaluation/rubrics/model/rubrics.entity';
import { RubricQuestionCriteriaEntity } from '../../rubric-question-criterias/model/rubric-question-criterias.entity';
import { RubricQuestionEntity } from '../../rubric-questions/model/rubric-questions.entity';
import { StudyPlanCourseEntity } from 'src/modules/academic/study-plan-courses/model/study-plan-courses.entity';
import { StudentSectionEnrollmentEntity } from 'src/modules/academic/student-section-enrollments/model/student-section-enrollments.entity';

const UNLIMITED_EVALUATOR_TYPE_CODE = TYPE_CODES.EVALUATOR_TYPE.COM;

/**
 * ProjectConfigService
 *
 * Servicio especializado para la configuración completa de proyectos.
 * Maneja la creación transaccional de proyectos con sus estudiantes y evaluadores asignados.
 */
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
	 * - study_plan_course debe existir y tener extra.is_evaluate_rubric = true
	 * - código y nombre únicos en el mismo periodo académico
	 * - alumnos activos, matriculados en el curso, sin proyecto en el mismo periodo
	 * - evaluadores sin duplicados de profesor+tipo, con límites por tipo
	 */
	async createProject(dto: CreateProjectDto): Promise<ProjectEntity> {
		// ── 1. Validar study_plan_course ──────────────────────────────────────
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

		if (studyPlanCourse.extra?.is_evaluate_rubric !== true) {
			throw new BadRequestException(projectsValidationStrings.error.notEvaluateRubric);
		}

		const academicPeriodId = studyPlanCourse.studyPlanAcademicPeriod?.academicPeriodId;
		if (!academicPeriodId) {
			throw new BadRequestException(projectsValidationStrings.error.noAcademicPeriod);
		}

		// ── 2. Unicidad de código en el mismo periodo ─────────────────────────
		const duplicateCode = await this.dataSource.query(
			`
			SELECT p.id FROM evaluation.projects p
			INNER JOIN evaluation.project_students ps ON ps.project_id = p.id
			INNER JOIN academic.student_section_enrollments sse ON sse.id = ps.student_section_enrollment_id
			INNER JOIN academic.course_sections cs ON cs.id = sse.course_section_id
			INNER JOIN academic.study_plan_courses spc ON spc.id = cs.study_plan_course_id
			INNER JOIN academic.study_plan_academic_periods spap ON spap.id = spc.study_plan_academic_period_id
			WHERE p.code = $1 AND spap.academic_period_id = $2
			LIMIT 1
			`,
			[dto.code, academicPeriodId],
		);
		if (duplicateCode.length > 0) {
			throw new BadRequestException(projectsValidationStrings.error.duplicateCode);
		}

		// ── 3. Unicidad de nombre en el mismo periodo ─────────────────────────
		const duplicateName = await this.dataSource.query(
			`
			SELECT p.id FROM evaluation.projects p
			INNER JOIN evaluation.project_students ps ON ps.project_id = p.id
			INNER JOIN academic.student_section_enrollments sse ON sse.id = ps.student_section_enrollment_id
			INNER JOIN academic.course_sections cs ON cs.id = sse.course_section_id
			INNER JOIN academic.study_plan_courses spc ON spc.id = cs.study_plan_course_id
			INNER JOIN academic.study_plan_academic_periods spap ON spap.id = spc.study_plan_academic_period_id
			WHERE (p.name->>'es' = $1 OR p.name->>'en' = $2) AND spap.academic_period_id = $3
			LIMIT 1
			`,
			[dto.name?.es, dto.name?.en, academicPeriodId],
		);
		if (duplicateName.length > 0) {
			throw new BadRequestException(projectsValidationStrings.error.duplicateName);
		}

		// ── 4. Validar alumnos ────────────────────────────────────────────────
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

			if (enrollment.courseSection?.studyPlanCourseId !== dto.studyPlanCourseId) {
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
				INNER JOIN academic.study_plan_courses spc ON spc.id = cs.study_plan_course_id
				INNER JOIN academic.study_plan_academic_periods spap ON spap.id = spc.study_plan_academic_period_id
				WHERE sse.enrolled_student_id = (
					SELECT enrolled_student_id FROM academic.student_section_enrollments WHERE id = $1
				)
				AND spap.academic_period_id = $2
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

		// ── 5. Validar evaluadores ────────────────────────────────────────────
		if (!dto.evaluators?.length) {
			throw new BadRequestException(projectsValidationStrings.error.noEvaluators);
		}

		const evaluatorTypeIds = [...new Set(dto.evaluators.map((e) => e.evaluatorTypeId))];
		const evaluatorTypes = await this.typeRepo.findByIds(evaluatorTypeIds);
		const typeCodeMap = new Map(evaluatorTypes.map((t) => [t.id, t.code]));

		const evalKeys = new Set<string>();
		for (const ev of dto.evaluators) {
			const key = `${ev.professorId}-${ev.evaluatorTypeId}`;
			if (evalKeys.has(key)) {
				throw new BadRequestException(projectsValidationStrings.error.evaluatorDuplicate);
			}
			evalKeys.add(key);
		}

		const typeCountInRequest = new Map<number, number>();
		for (const ev of dto.evaluators) {
			typeCountInRequest.set(
				ev.evaluatorTypeId,
				(typeCountInRequest.get(ev.evaluatorTypeId) ?? 0) + 1,
			);
		}

		for (const [typeId, count] of typeCountInRequest.entries()) {
			const code = typeCodeMap.get(typeId);
			if (code !== UNLIMITED_EVALUATOR_TYPE_CODE && count > 1) {
				throw new BadRequestException(projectsValidationStrings.error.evaluatorLimit);
			}
		}

		// ── 6. Crear en transacción ───────────────────────────────────────────
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

	/**
	 * Obtiene un proyecto con sus detalles, incluyendo estudiantes, rúbrica, y scores
	 */
	async getProjectWithDetails(
		projectId: number,
		isEvaluationMode: boolean,
		gradeTypeCode?: string,
		rubricTypeId?: number,
	): Promise<ProjectDetailsResponseDto> {
		const gradeTypeId = gradeTypeCode
			? await this.resolveGradeTypeIdByCode(gradeTypeCode)
			: undefined;
		// ── 1. Proyecto con cadena de enrollment ─────────────────────────────
		const project = await this.projectRepo
			.createQueryBuilder('p')
			.leftJoinAndSelect('p.students', 's')
			.leftJoinAndSelect('s.studentSectionEnrollment', 'sse')
			.leftJoinAndSelect('sse.enrolledStudent', 'es')
			.leftJoinAndSelect('es.student', 'stu')
			.leftJoinAndSelect('stu.user', 'suser')
			.leftJoinAndSelect('sse.courseSection', 'cs')
			.leftJoinAndSelect('cs.studyPlanCourse', 'spc')
			.leftJoinAndSelect('spc.studyPlanAcademicPeriod', 'spap')
			.leftJoinAndSelect('spap.academicPeriod', 'ap')
			.leftJoinAndSelect('p.evaluators', 'pe')
			.leftJoinAndSelect('pe.professor', 'prof')
			.leftJoinAndSelect('prof.staff', 'staff')
			.leftJoinAndSelect('staff.user', 'puser')
			.where('p.id = :projectId', { projectId })
			.getOne();

		if (!project) {
			throw new NotFoundException(projectsValidationStrings.error.notFound);
		}

		const studentWithChain = project.students?.find(
			(s) => s.studentSectionEnrollment?.courseSection?.studyPlanCourseId != null,
		);

		const studyPlanCourseId =
			studentWithChain?.studentSectionEnrollment?.courseSection?.studyPlanCourseId;

		if (!studyPlanCourseId) {
			throw new BadRequestException(projectsValidationStrings.error.noStudentsWithCourse);
		}

		const academicPeriod =
			studentWithChain?.studentSectionEnrollment?.courseSection?.studyPlanCourse
				?.studyPlanAcademicPeriod?.academicPeriod;

		// ── 3. Rúbrica específica: curso + tipo de evaluación + tipo de rúbrica
		const rubricWhere: any = {
			studyPlanCourseId: studyPlanCourseId,
			isActive: true,
		};

		if (gradeTypeId) rubricWhere.gradeTypeId = gradeTypeId;
		if (rubricTypeId) rubricWhere.rubricTypeId = rubricTypeId;

		const rubric = await this.dataSource
			.getRepository(RubricEntity)
			.createQueryBuilder('r')
			.where('r.study_plan_course_id = :studyPlanCourseId', { studyPlanCourseId })
			.andWhere('r.is_active = :isActive', { isActive: true })
			.andWhere(gradeTypeId ? 'r.grade_type_id = :gradeTypeId' : '1=1', { gradeTypeId })
			.andWhere(rubricTypeId ? 'r.rubric_type_id = :rubricTypeId' : '1=1', { rubricTypeId })
			.getOne();

		if (!rubric) {
			throw new NotFoundException(projectsValidationStrings.error.activeRubricNotFound);
		}

		const rubricContext = await this.rubricConfigService
			.getRubricWithContextData(rubric.id)
			.catch(() => null);

		if (!rubricContext) {
			throw new NotFoundException(projectsValidationStrings.error.rubricContextError);
		}

		// ── 5. Score máximo (solo en modo evaluación)
		let totalMaxScore = 0;
		if (isEvaluationMode) {
			const maxScoreData = await this.rubricConfigService
				.recalculateMaxScore(rubric.id)
				.catch(() => ({ totalMaxScore: 0 }));
			totalMaxScore = maxScoreData.totalMaxScore || 0;
		}

		// ── 6. Evaluaciones filtradas por la rúbrica específica
		// Sin rubric_id en evidence.evaluations, se filtra por los criterios
		// de la rúbrica a través de los scores (evaluaciones sin scores aún
		// se excluyen — son evaluaciones vacías de este contexto)
		let evaluations: EvaluationEntity[] = [];

		if (isEvaluationMode) {
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
				.andWhere('rq.rubric_id = :rubricId', { rubricId: rubric.id })
				.getMany();
		}

		// ── 7. Estudiantes con nota total
		const studentDtos = (project.students || []).map((s) => {
			const user = s.studentSectionEnrollment?.enrolledStudent?.student?.user;
			const evals = evaluations.filter((ev) => ev.projectStudentId === s.id);

			let totalGrade: number | null = null;

			if (isEvaluationMode && evals.length > 0) {
				const sumScores = evals.reduce((sum, ev) => {
					const evalSum = (ev.scores || []).reduce((sSum, score) => sSum + Number(score.score), 0);
					return sum + evalSum;
				}, 0);

				// Escalar a vigesimal
				if (totalMaxScore > 0) {
					totalGrade = Math.round(((sumScores * 20) / totalMaxScore) * 100) / 100;
				} else {
					totalGrade = sumScores; // Fallback si maxScore = 0
				}
			}

			const evaluationStatuses = isEvaluationMode
				? evals.map((ev) => ({
						evaluatorId: ev.projectEvaluatorId,
						qualificationStatusTypeId: ev.qualificationStatusTypeId,
					}))
				: [];

			return {
				id: s.id,
				studentId: s.studentSectionEnrollment?.enrolledStudent?.studentId || 0,
				firstName: user?.firstName || '',
				lastName: user?.lastName || '',
				email: user?.email || '',
				studentCode: user?.documentCode ? String(user.documentCode) : '',
				totalGrade: isEvaluationMode ? totalGrade : null,
				evaluations: evaluationStatuses,
			};
		});

		// ── 8. Preguntas + criterios con scores inyectados
		const questions = (rubricContext.questions || []).map((q: any) => ({
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

		// ── 9. Mapear evaluadores con info del docente y tipo
		const evaluatorTypeIds = [...new Set((project.evaluators || []).map((e) => e.evaluatorTypeId))];
		const evaluatorTypesMap = new Map<number, any>();

		if (evaluatorTypeIds.length > 0) {
			const types = await this.typeRepo.findByIds(evaluatorTypeIds);
			types.forEach((t) => evaluatorTypesMap.set(t.id, t));
		}

		const evaluatorDtos = (project.evaluators || []).map((e) => {
			const professorUser = e.professor?.staff?.user;
			const evaluatorType = evaluatorTypesMap.get(e.evaluatorTypeId);

			return {
				id: e.id,
				professorId: e.professorId,
				professorFirstName: professorUser?.firstName || '',
				professorLastName: professorUser?.lastName || '',
				professorEmail: professorUser?.email || '',
				evaluatorTypeId: e.evaluatorTypeId,
				evaluatorTypeName: evaluatorType?.name || '',
			};
		});

		// ── 10. Response
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
			rubric: {
				rubric: rubricContext.rubric,
				course: rubricContext.course,
				outcomes: rubricContext.outcomes,
				questions,
			},
		};
	}

	/**
	 * Obtiene un proyecto con todos sus estudiantes y evaluadores
	 */

	async getProjectsByProfessor(
		professorId: number,
		academicPeriodId?: number,
		schoolId?: number,
		gradeTypeCode?: string,
	): Promise<ProjectEvaluatorResponseDto[]> {
		const gradeTypeId = gradeTypeCode
			? await this.resolveGradeTypeIdByCode(gradeTypeCode)
			: undefined;
		// ── QUERY 1 ───────────────────────────────────────────────────────────
		let filterSql = `
    SELECT DISTINCT pe.project_id AS "projectId"
    FROM evaluation.project_evaluators pe
    INNER JOIN evaluation.project_students ps ON ps.project_id = pe.project_id
    INNER JOIN academic.student_section_enrollments sse ON sse.id = ps.student_section_enrollment_id
    INNER JOIN academic.course_sections cs ON cs.id = sse.course_section_id
    INNER JOIN academic.study_plan_courses spc ON spc.id = cs.study_plan_course_id
    INNER JOIN academic.study_plan_academic_periods sp_ap ON sp_ap.id = spc.study_plan_academic_period_id
    INNER JOIN academic.study_plans sp ON sp.id = sp_ap.study_plan_id
    INNER JOIN academic.programs program ON program.id = sp.program_id
    WHERE pe.professor_id = $1 AND pe.is_active = true
  `;

		const params: any[] = [professorId];
		let paramIdx = 2;

		if (gradeTypeId) {
			filterSql += `
      AND EXISTS (
        SELECT 1
        FROM evaluation.rubrics r
        WHERE r.study_plan_course_id IN (
          SELECT spc2.id
          FROM evaluation.project_students ps2
          INNER JOIN academic.student_section_enrollments sse2
                  ON sse2.id = ps2.student_section_enrollment_id
          INNER JOIN academic.course_sections cs2
                  ON cs2.id = sse2.course_section_id
          INNER JOIN academic.study_plan_courses spc2
                  ON spc2.id = cs2.study_plan_course_id
          WHERE ps2.project_id = pe.project_id
        )
        AND r.grade_type_id = $${paramIdx}
      )
    `;
			params.push(gradeTypeId);
			paramIdx++;
		}

		if (academicPeriodId) {
			filterSql += ` AND sp_ap.academic_period_id = $${paramIdx}`;
			params.push(academicPeriodId);
			paramIdx++;
		}

		const programIdsPromise = schoolId
			? this.resolveProgramIdsBySchoolId(schoolId)
			: Promise.resolve(null);
		const programIds = await programIdsPromise;

		if (programIds !== null) {
			if (programIds.length === 0) return [];
			filterSql += ` AND program.id = ANY($${paramIdx}::int[])`;
			params.push(programIds);
		}

		const rows = (await this.dataSource.query(filterSql, params)) as { projectId: number }[];

		const projectIds = rows.map((r) => r.projectId);
		if (projectIds.length === 0) return [];

		// ── QUERY 2: todo en SQL nativo para evitar el producto cartesiano ────
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
        WHERE ev_ps.project_id = p.id
      )                 AS "evaluationDate",
      -- evaluadores
      all_pe.id         AS "evalId",
      all_pe.professor_id AS "evalProfessorId",
      all_u.first_name  AS "evalFirstName",
      all_u.last_name   AS "evalLastName",
      all_u.email       AS "evalEmail",
      all_et.name       AS "evalTypeName",
      -- estudiantes
      ps.id             AS "studentPsId",
      stu.id            AS "studentId",
      su.first_name     AS "stuFirstName",
      su.last_name      AS "stuLastName",
      su.email          AS "stuEmail",
      su.document_code  AS "stuCode",
      -- curso
      c.name            AS "courseName"
    FROM evaluation.projects p
    LEFT JOIN evaluation.project_evaluators all_pe ON all_pe.project_id = p.id
    LEFT JOIN academic.professors all_prof         ON all_prof.id = all_pe.professor_id
    LEFT JOIN organization.staff all_st            ON all_st.id = all_prof.staff_id
    LEFT JOIN organization.users all_u             ON all_u.id = all_st.user_id
    LEFT JOIN core.types all_et                    ON all_et.id = all_pe.evaluator_type_id
    LEFT JOIN evaluation.project_students ps       ON ps.project_id = p.id
    LEFT JOIN academic.student_section_enrollments sse ON sse.id = ps.student_section_enrollment_id
    LEFT JOIN academic.enrolled_students es        ON es.id = sse.enrolled_student_id
    LEFT JOIN academic.students stu                ON stu.id = es.student_id
    LEFT JOIN organization.users su                ON su.id = stu.user_id
    LEFT JOIN academic.course_sections cs          ON cs.id = sse.course_section_id
    LEFT JOIN academic.study_plan_courses spc      ON spc.id = cs.study_plan_course_id
    LEFT JOIN academic.courses c                   ON c.id = spc.course_id
    WHERE p.id = ANY($1::int[])
  `,
			[projectIds],
		)) as any[];

		// ── Agrupar filas por project_id ──────────────────────────────────────
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

			// Evaluadores (deduplicar por evalId)
			if (row.evalId && !(project.evaluators as any[]).find((e: any) => e.id === row.evalId)) {
				(project.evaluators as any[]).push({
					id: row.evalId,
					professorId: row.evalProfessorId,
					firstName: row.evalFirstName || '',
					lastName: row.evalLastName || '',
					email: row.evalEmail || '',
					evaluatorType: row.evalTypeName || '',
				});
			}

			// Estudiantes (deduplicar por studentPsId)
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

		return Array.from(projectMap.values());
	}
}
