import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ProjectEntity } from '../model/projects.entity';
import { ProjectStudentEntity } from 'src/modules/evaluation/project-students/model/project-students.entity';
import { ProjectEvaluatorEntity } from 'src/modules/evaluation/project-evaluators/model/project-evaluators.entity';
import { CreateProjectDto, ProjectEvaluatorResponseDto } from '../model/projects.dtos';
import { TypeEntity } from 'src/modules/core/types/model/types.entity';

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
		private readonly dataSource: DataSource,
	) {}

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
	 * Obtiene todos los proyectos asignados a un evaluador
	 */
	async getProjectsByEvaluator(evaluatorId: number): Promise<ProjectEvaluatorResponseDto[]> {
		const projectEvaluators = await this.projectEvaluatorRepo
			.createQueryBuilder('pe')
			.leftJoinAndSelect('pe.evaluator_type', 'etype')
			.leftJoinAndSelect('pe.professor', 'eprof')
			.leftJoinAndSelect('eprof.staff', 'estaff')
			.leftJoinAndSelect('estaff.user', 'euser')
			.leftJoinAndSelect('pe.project', 'p')
			.leftJoinAndSelect('p.students', 's')
			.leftJoinAndSelect('s.student_section_enrollment', 'sse')
			.leftJoinAndSelect('sse.enrolled_student', 'es')
			.leftJoinAndSelect('es.student', 'stu')
			.leftJoinAndSelect('stu.user', 'suser')
			.leftJoinAndSelect('sse.course_section', 'cs')
			.leftJoinAndSelect('cs.study_plan_course', 'spc')
			.leftJoinAndSelect('spc.course', 'c')
			.where('pe.professor_id = :evaluatorId', { evaluatorId })
			.getMany();

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
				evaluator: {
					id: pe.id, // project_evaluator_id
					professor_id: pe.professor_id,
					first_name: pe.professor?.staff?.user?.first_name || '',
					last_name: pe.professor?.staff?.user?.last_name || '',
					email: pe.professor?.staff?.user?.email || '',
					evaluator_type: pe.evaluator_type?.code || '',
				},
				students: (p?.students || []).map((s) => {
					const user = s.student_section_enrollment?.enrolled_student?.student?.user;
					return {
						id: s.id, // project_student_id
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
