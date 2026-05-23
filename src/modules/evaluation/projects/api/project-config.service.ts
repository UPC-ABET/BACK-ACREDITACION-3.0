import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';
import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ProjectEntity } from '../model/projects.entity';
import { ProjectStudentEntity } from 'src/modules/evaluation/project-students/model/project-students.entity';
import { ProjectEvaluatorEntity } from 'src/modules/evaluation/project-evaluators/model/project-evaluators.entity';
import { CreateProjectDto, ProjectEvaluatorResponseDto, ProjectDetailsResponseDto } from '../model/projects.dtos';
import { TypeEntity } from 'src/modules/core/types/model/types.entity';
import { RubricConfigService } from 'src/modules/evaluation/rubrics/api/rubric-config.service';
import { EvaluationEntity } from 'src/modules/evidence/evaluations/model/evaluations.entity';
import { RubricEntity } from 'src/modules/evaluation/rubrics/model/rubrics.entity';
import { RubricQuestionCriteriaEntity } from '../../rubric-question-criterias/model/rubric-question-criterias.entity';
import { RubricQuestionEntity } from '../../rubric-questions/model/rubric-questions.entity';

/**
 * ProjectConfigService
 *
 * Servicio especializado para la configuración completa de proyectos.
 * Maneja la creación transaccional de proyectos con sus estudiantes y evaluadores asignados.
 */
@Injectable()
export class ProjectConfigService {
	private readonly DEFAULT_EVALUATOR_TYPE_CODE = 'TG403-T003';

	constructor(
		@InjectRepository(ProjectEntity)
		private readonly projectRepo: Repository<ProjectEntity>,
		@InjectRepository(ProjectStudentEntity)
		private readonly projectStudentRepo: Repository<ProjectStudentEntity>,
		@InjectRepository(ProjectEvaluatorEntity)
		private readonly projectEvaluatorRepo: Repository<ProjectEvaluatorEntity>,
		@InjectRepository(TypeEntity)
		private readonly typeRepo: Repository<TypeEntity>,
		@Inject(forwardRef(() => RubricConfigService))
		private readonly rubricConfigService: RubricConfigService,
		private readonly dataSource: DataSource,
	) {}

	private async resolveProgramIdsBySchoolId(schoolId: number): Promise<number[]> {
		const raw = await this.dataSource.query(
			`
                        WITH RECURSIVE school_tree AS (
                                SELECT id, root_chart_detail_id, entity_type_id, entity_code
                                FROM "organization"."charts"
                                WHERE entity_type_id = (SELECT id FROM "core"."types" WHERE code = $1)
                                  AND entity_code = $2
                                UNION ALL
                                SELECT c.id, c.root_chart_detail_id, c.entity_type_id, c.entity_code
                                FROM "organization"."charts" c
                                INNER JOIN school_tree st ON c.root_chart_detail_id = st.id
                        )
                        SELECT DISTINCT entity_code AS program_id
                        FROM school_tree
                        WHERE entity_type_id = (SELECT id FROM "core"."types" WHERE code = $3)
                          AND entity_code IS NOT NULL
                        `,
			[TYPE_CODES.ENTITY_TYPE.SCHOOL, schoolId, TYPE_CODES.ENTITY_TYPE.PROGRAM],
		);
		return raw.map((row: { program_id: number }) => row.program_id);
	}

	private async resolveEvaluatorTypeIdByCode(code: string): Promise<number> {
		const type = await this.typeRepo.findOne({ where: { code } });
		if (!type) {
			throw new BadRequestException(`Tipo de evaluador con código '${code}' no encontrado en core.types.`);
		}
		return type.id;
	}

	/**
	 * Crea un proyecto completo con sus estudiantes y evaluadores de forma transaccional
	 *
	 * Operaciones:
	 * 1. Crea el proyecto base
	 * 2. Asigna estudiantes al proyecto
	 * 3. Asigna evaluadores al proyecto con tipo DOC (resuelto desde core.types)
	 * 4. Todo se guarda de forma transaccional o se revierte
	 */
	async createProject(dto: CreateProjectDto): Promise<ProjectEntity> {
		const evaluatorTypeId = await this.resolveEvaluatorTypeIdByCode(this.DEFAULT_EVALUATOR_TYPE_CODE);

		const queryRunner = this.dataSource.createQueryRunner();
		await queryRunner.connect();
		await queryRunner.startTransaction();

		try {
			// 1. Guardar Proyecto Base
			const project = queryRunner.manager.create(ProjectEntity, {
				code: dto.code,
				name: dto.name,
				description: dto.description,
				is_active: dto.is_active ?? true,
				extra: dto.extra,
			});

			const savedProject = await queryRunner.manager.save(project);

			// 2. Guardar Estudiantes Asignados al Proyecto
			if (dto.student_section_enrollment_ids && dto.student_section_enrollment_ids.length > 0) {
				const projectStudents = dto.student_section_enrollment_ids.map((studentId) =>
					queryRunner.manager.create(ProjectStudentEntity, {
						project_id: savedProject.id,
						student_section_enrollment_id: studentId,
						is_active: true,
					}),
				);
				await queryRunner.manager.save(projectStudents);
			}

			// 3. Guardar Evaluadores Asignados al Proyecto (tipo DOC desde core.types)
			if (dto.evaluator_professor_ids && dto.evaluator_professor_ids.length > 0) {
				const projectEvaluators = dto.evaluator_professor_ids.map((professorId) =>
					queryRunner.manager.create(ProjectEvaluatorEntity, {
						project_id: savedProject.id,
						professor_id: professorId,
						evaluator_type_id: evaluatorTypeId,
						is_active: true,
					}),
				);
				await queryRunner.manager.save(projectEvaluators);
			}

			await queryRunner.commitTransaction();
			return savedProject;
		} catch (error) {
			await queryRunner.rollbackTransaction();
			throw error;
		} finally {
			await queryRunner.release();
		}
	}

	/**
	 * Obtiene un proyecto con sus detalles, incluyendo estudiantes, rúbrica, y scores
	 */
	async getProjectWithDetails(
		projectId: number,
		isEvaluationMode: boolean,
		gradeTypeId?: number,
		rubricTypeId?: number,
	): Promise<ProjectDetailsResponseDto> {

		// ── 1. Proyecto con cadena de enrollment ─────────────────────────────
		const project = await this.projectRepo
			.createQueryBuilder('p')
			.leftJoinAndSelect('p.students', 's')
			.leftJoinAndSelect('s.student_section_enrollment', 'sse')
			.leftJoinAndSelect('sse.enrolled_student', 'es')
			.leftJoinAndSelect('es.student', 'stu')
			.leftJoinAndSelect('stu.user', 'suser')
			.leftJoinAndSelect('sse.course_section', 'cs')
			.leftJoinAndSelect('cs.study_plan_course', 'spc')
			.leftJoinAndSelect('p.evaluators', 'pe')
			.where('p.id = :projectId', { projectId })
			.getOne();

		if (!project) {
			throw new NotFoundException('Proyecto no encontrado.');
		}

		// ── 2. study_plan_course_id desde el primer estudiante con cadena completa
		const studyPlanCourseId = project.students
			?.find(s => s.student_section_enrollment?.course_section?.study_plan_course_id != null)
			?.student_section_enrollment?.course_section?.study_plan_course_id;

		if (!studyPlanCourseId) {
			throw new BadRequestException('El proyecto no tiene estudiantes con curso asignado.');
		}

		// ── 3. Rúbrica específica: curso + tipo de evaluación + tipo de rúbrica
		const rubricWhere: any = {
			study_plan_course_id: studyPlanCourseId,
			is_active: true,
		};

		if (gradeTypeId) rubricWhere.grade_type_id = gradeTypeId;
		if (rubricTypeId) rubricWhere.rubric_type_id = rubricTypeId;

		const rubric = await this.dataSource
			.getRepository(RubricEntity)
			.createQueryBuilder('r')
			.where('r.study_plan_course_id = :studyPlanCourseId', { studyPlanCourseId })
			.andWhere('r.is_active = :isActive', { isActive: true })
			.andWhere(gradeTypeId ? 'r.grade_type_id = :gradeTypeId' : '1=1', { gradeTypeId })
			.andWhere(rubricTypeId ? 'r.rubric_type_id = :rubricTypeId' : '1=1', { rubricTypeId })
			.getOne();

		if (!rubric) {
			throw new NotFoundException(
				`No se encontró rúbrica activa para el curso ${studyPlanCourseId} ` +
				`con grade_type_id=${gradeTypeId} y rubric_type_id=${rubricTypeId}.`,
			);
		}

		const rubricContext = await this.rubricConfigService.getRubricWithContextData(rubric.id).catch(() => null);

		if (!rubricContext) {
			throw new NotFoundException('Error al cargar el contexto de la rúbrica.');
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
				.innerJoin('ev.project_student', 'ps')
				.innerJoin(
					RubricQuestionCriteriaEntity,
					'rqc',
					'rqc.id = score.rubric_question_criteria_id',
				)
				.innerJoin(
					RubricQuestionEntity,
					'rq',
					'rq.id = rqc.rubric_question_id',
				)
				.where('ps.project_id = :projectId', { projectId })
				.andWhere('rq.rubric_id = :rubricId', { rubricId: rubric.id })
				.getMany();
		}

		// ── 7. Estudiantes con nota total
		const studentDtos = (project.students || []).map((s) => {
			const user = s.student_section_enrollment?.enrolled_student?.student?.user;
			const evals = evaluations.filter(ev => ev.project_student_id === s.id);

			let totalGrade: number | null = null;

			if (isEvaluationMode && evals.length > 0) {
				const sumScores = evals.reduce((sum, ev) => {
					const evalSum = (ev.scores || []).reduce(
						(sSum, score) => sSum + Number(score.score), 0,
					);
					return sum + evalSum;
				}, 0);
				
				// Escalar a vigesimal
				if (totalMaxScore > 0) {
					totalGrade = Math.round(((sumScores * 20) / totalMaxScore) * 100) / 100;
				} else {
					totalGrade = sumScores; // Fallback si maxScore = 0
				}
			}

			return {
				id: s.id,
				first_name: user?.first_name || '',
				last_name: user?.last_name || '',
				email: user?.email || '',
				student_code: user?.document_code ? String(user.document_code) : '',
				total_grade: isEvaluationMode ? totalGrade : null,
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
					evaluations.forEach(ev => {
						const scoreObj = (ev.scores || []).find(
							sc => sc.rubric_question_criteria_id === c.id,
						);
						if (scoreObj) {
							criteriaScores!.push({
								student_id: ev.project_student_id,
								evaluator_id: ev.project_evaluator_id,
								score: Number(scoreObj.score),
								commentaries: scoreObj.commentaries || '',
							});
						}
					});
				}

				return {
					id: c.id,
					text: c.text,
					min_value: c.min_value,
					max_value: c.max_value,
					scores: criteriaScores,
				};
			}),
		}));

		// ── 9. Response
		return {
			project: {
				id: project.id,
				code: project.code || '',
				name: project.name,
				description: project.description || { es: '', en: '' },
			},
			students: studentDtos,
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
	async getProjectById(id: number): Promise<ProjectEntity> {
		const project = await this.projectRepo.findOne({
			where: { id },
			relations: ['students', 'evaluators'],
		});

		if (!project) {
			throw new NotFoundException('Proyecto no encontrado.');
		}

		return project;
	}

	/**
	 * Obtiene todos los proyectos asignados a un profesor evaluador
	 */
	async getProjectsByProfessor(professorId: number, academicPeriodId?: number, schoolId?: number, gradeTypeId?: number): Promise<ProjectEvaluatorResponseDto[]> {
		const qb = this.projectEvaluatorRepo
			.createQueryBuilder('pe')
			.leftJoinAndSelect('pe.evaluator_type', 'etype')
			.leftJoinAndSelect('pe.professor', 'eprof')
			.leftJoinAndSelect('eprof.staff', 'estaff')
			.leftJoinAndSelect('estaff.user', 'euser')
			.leftJoinAndSelect('pe.project', 'p')
			.leftJoinAndSelect('p.evaluators', 'all_pe') // todos los evaluadores del proyecto
			.leftJoinAndSelect('all_pe.professor', 'all_prof')
			.leftJoinAndSelect('all_prof.staff', 'all_staff')
			.leftJoinAndSelect('all_staff.user', 'all_user')
			.leftJoinAndSelect('all_pe.evaluator_type', 'all_etype')
			.leftJoinAndSelect('p.students', 's')
			.leftJoinAndSelect('s.student_section_enrollment', 'sse')
			.leftJoinAndSelect('sse.enrolled_student', 'es')
			.leftJoinAndSelect('es.student', 'stu')
			.leftJoinAndSelect('stu.user', 'suser')
			.leftJoinAndSelect('sse.course_section', 'cs')
			.leftJoinAndSelect('cs.study_plan_course', 'spc')
			.leftJoinAndSelect('spc.course', 'c')
			// Joins adicionales para aplicar filtros
			.leftJoin('p.rubric', 'rubric')
			.leftJoin('spc.study_plan', 'sp')
			.leftJoin('sp.program', 'program')
			.leftJoin('spc.study_plan_academic_periods', 'sp_ap')
			.where('pe.professor_id = :professorId', { professorId });

		if (gradeTypeId) {
			qb.andWhere('rubric.grade_type_id = :gradeTypeId', { gradeTypeId });
		}

		if (academicPeriodId) {
			qb.andWhere('sp_ap.academic_period_id = :academicPeriodId', { academicPeriodId });
		}

		if (schoolId) {
			const programIds = await this.resolveProgramIdsBySchoolId(schoolId);
			if (programIds.length > 0) {
				qb.andWhere('program.id IN (:...programIds)', { programIds });
			} else {
				qb.andWhere('1 = 0');
			}
		}

		const projectEvaluators = await qb.getMany();

		return projectEvaluators.map((pe) => {
			const p = pe.project;
			const courseName =
				p?.students?.[0]?.student_section_enrollment?.course_section?.study_plan_course?.course?.name;

			const resolvedCourseName = typeof courseName === 'string'
				? courseName
				: (courseName?.es || courseName?.en || '');

			return {
				project_id: p?.id,
				project_code: p?.code || '',
				project_name: p?.name,
				evaluation_date: p?.created_at,
				course_name: resolvedCourseName,
				evaluators: (p?.evaluators || []).map((allPe) => ({
					id: allPe.id,
					professor_id: allPe.professor_id,
					first_name: allPe.professor?.staff?.user?.first_name || '',
					last_name: allPe.professor?.staff?.user?.last_name || '',
					email: allPe.professor?.staff?.user?.email || '',
					evaluator_type: allPe.evaluator_type?.name || '',
				})),
				students: (p?.students || []).map((s) => {
					const user = s.student_section_enrollment?.enrolled_student?.student?.user;
					return {
						id: s.id,
						first_name: user?.first_name || '',
						last_name: user?.last_name || '',
						email: user?.email || '',
						student_code: user?.document_code ? String(user.document_code) : '',
					};
				}),
			};
		}) as any;
	}
}
