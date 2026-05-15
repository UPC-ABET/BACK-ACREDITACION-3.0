import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ProjectEntity } from '../model/projects.entity';
import { ProjectStudentEntity } from 'src/modules/evaluation/project-students/model/project-students.entity';
import { ProjectEvaluatorEntity } from 'src/modules/evaluation/project-evaluators/model/project-evaluators.entity';
import { CreateProjectDto } from '../model/projects.dtos';

/**
 * ProjectConfigService
 *
 * Servicio especializado para la configuración completa de proyectos.
 * Maneja la creación transaccional de proyectos con sus estudiantes y evaluadores asignados.
 */
@Injectable()
export class ProjectConfigService {
	// TODO: Constante temporal - Según el plan, será manejado por core.types (ej. Id 1 = PROFESOR)
	private readonly DEFAULT_EVALUATOR_TYPE_ID = 1;

	constructor(
		@InjectRepository(ProjectEntity)
		private readonly projectRepo: Repository<ProjectEntity>,
		@InjectRepository(ProjectStudentEntity)
		private readonly projectStudentRepo: Repository<ProjectStudentEntity>,
		@InjectRepository(ProjectEvaluatorEntity)
		private readonly projectEvaluatorRepo: Repository<ProjectEvaluatorEntity>,
		private readonly dataSource: DataSource,
	) {}

	/**
	 * Crea un proyecto completo con sus estudiantes y evaluadores de forma transaccional
	 *
	 * Operaciones:
	 * 1. Crea el proyecto base
	 * 2. Asigna estudiantes al proyecto
	 * 3. Asigna evaluadores al proyecto
	 * 4. Todo se guarda de forma transaccional o se revierte
	 */
	async createProject(dto: CreateProjectDto): Promise<ProjectEntity> {
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

			// 3. Guardar Evaluadores Asignados al Proyecto
			if (dto.evaluator_professor_ids && dto.evaluator_professor_ids.length > 0) {
				const projectEvaluators = dto.evaluator_professor_ids.map((professorId) =>
					queryRunner.manager.create(ProjectEvaluatorEntity, {
						project_id: savedProject.id,
						professor_id: professorId,
						evaluator_type_id: this.DEFAULT_EVALUATOR_TYPE_ID,
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
	async getProjectsByEvaluator(evaluatorId: number): Promise<ProjectEntity[]> {
		const projects = await this.projectRepo
			.createQueryBuilder('p')
			.leftJoinAndSelect('p.evaluators', 'e')
			.leftJoinAndSelect('p.students', 's')
			.where('e.id = :evaluatorId', { evaluatorId })
			.getMany();

		return projects;
	}
}
