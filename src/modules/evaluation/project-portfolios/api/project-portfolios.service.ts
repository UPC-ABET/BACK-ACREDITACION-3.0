import { Injectable, NotFoundException, HttpException, HttpStatus } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import * as XLSX from 'xlsx';

import { BaseService } from 'src/commons/base.service';
import { ProjectPortfolioRepository } from '../core/project-portfolios.repository';
import { ProjectPortfolioValidation } from '../core/project-portfolios.validation';
import {
	CreateProjectPortfolioDto,
	UpdateProjectPortfolioDto,
	UpdateProjectPortfolioManagerDto,
	FilterProjectPortfolioDto,
	PageDto,
	PaginatedProjectPortfolioRequestDto,
	MigrateProjectPortfoliosDto,
	MigrateFromDatabaseDto,
	ManagementAssignDto,
	AutoAssignPartnerDto,
	ProjectPortfolioResponseDto,
} from '../model/project-portfolios.dtos';
import { ProjectPortfolioEntity, ProjectPortfolioStatus } from '../model/project-portfolios.entity';

@Injectable()
export class ProjectPortfolioService extends BaseService<ProjectPortfolioRepository> {
	constructor(
		protected readonly repository: ProjectPortfolioRepository,
		protected readonly dataSource: DataSource,
	) {
		super(repository);
	}

	// %% =====================================================================
	// %%  HELPERS
	// %% =====================================================================
	private toEntityFromCreate(dto: CreateProjectPortfolioDto): Partial<ProjectPortfolioEntity> {
		const academicPeriodId = dto.periodoAcademicoId ?? dto.academicPeriodId;
		const modalityId = dto.idModalidad ?? dto.modalityId;
		const careerId = dto.idCarrera ?? dto.careerId;
		const companyId = dto.idEmpresa ?? dto.companyId;
		const companyCode = dto.codigoEmpresa ?? dto.companyCode;

		return {
			code: dto.code ?? `PP-${Date.now()}`,
			name: dto.name,
			description: dto.description,
			problem_solved: dto.problemSolved,
			goal: dto.goal,
			is_from_upc: dto.isFromUPC ?? false,
			status: ProjectPortfolioStatus.PENDING,
			academic_period_id: academicPeriodId,
			modality_id: modalityId,
			career_id: careerId,
			company_id: companyId,
			company_code: companyCode,
			course_id: dto.courseId,
			research_line_id: dto.researchLineId,
			student_one_id: dto.studentOneId,
			student_two_id: dto.studentTwoId,
			coauthor_id: dto.coautorId,
			consultant_id: dto.consultantId,
		};
	}

	private toEntityFromUpdate(dto: UpdateProjectPortfolioDto): Partial<ProjectPortfolioEntity> {
		const out: Partial<ProjectPortfolioEntity> = {};
		if (dto.code !== undefined) out.code = dto.code;
		if (dto.name !== undefined) out.name = dto.name;
		if (dto.description !== undefined) out.description = dto.description;
		if (dto.problemSolved !== undefined) out.problem_solved = dto.problemSolved;
		if (dto.goal !== undefined) out.goal = dto.goal;
		if (dto.isFromUPC !== undefined) out.is_from_upc = dto.isFromUPC;
		if (dto.status !== undefined) out.status = dto.status;
		if (dto.idPeriodoAcademico !== undefined) out.academic_period_id = dto.idPeriodoAcademico;
		if (dto.idModalidad !== undefined) out.modality_id = dto.idModalidad;
		if (dto.idCarrera !== undefined) out.career_id = dto.idCarrera;
		if (dto.idEmpresa !== undefined) out.company_id = dto.idEmpresa;
		if (dto.codigoEmpresa !== undefined) out.company_code = dto.codigoEmpresa;
		if (dto.researchLineId !== undefined) out.research_line_id = dto.researchLineId;
		if (dto.studentOneId !== undefined) out.student_one_id = dto.studentOneId;
		if (dto.studentTwoId !== undefined) out.student_two_id = dto.studentTwoId;
		if (dto.coautorId !== undefined) out.coauthor_id = dto.coautorId;
		if (dto.consultantId !== undefined) out.consultant_id = dto.consultantId;
		return out;
	}

	private toResponse(entity: ProjectPortfolioEntity): ProjectPortfolioResponseDto {
		return {
			projectId: entity.id,
			code: entity.code,
			name: entity.name,
			description: entity.description,
			problemSolved: entity.problem_solved,
			goal: entity.goal,
			isFromUPC: entity.is_from_upc,
			status: entity.status,
			idPeriodoAcademico: entity.academic_period_id,
			idModalidad: entity.modality_id,
			idEmpresa: entity.company_id,
			codigoEmpresa: entity.company_code,
			idCarrera: entity.career_id,
			courseId: entity.course_id,
			researchLineId: entity.research_line_id,
			studentOneId: entity.student_one_id,
			studentTwoId: entity.student_two_id,
			coautorId: entity.coauthor_id,
			consultantId: entity.consultant_id,
			activeEnrollmentStudentOneId: entity.active_enrollment_student_one_id,
			activeEnrollmentStudentTwoId: entity.active_enrollment_student_two_id,
		};
	}

	// %% =====================================================================
	// %%  CRUD PRINCIPAL
	// %% =====================================================================
	async createPortfolio(dto: CreateProjectPortfolioDto, _college?: string) {
		await ProjectPortfolioValidation.validateCreate(this.repository, dto);

		return await this.dataSource.transaction(async (manager: EntityManager) => {
			const data = this.toEntityFromCreate(dto);
			const created = await this.repository.create(data, manager);
			return this.toResponse(created);
		});
	}

	async updatePortfolio(dto: UpdateProjectPortfolioDto, _college?: string) {
		if (!dto.projectId) {
			throw new HttpException('projectId requerido', HttpStatus.BAD_REQUEST);
		}
		const projectId = dto.projectId;
		await ProjectPortfolioValidation.validateUpdate(this.repository, projectId, dto);

		return await this.dataSource.transaction(async (manager: EntityManager) => {
			const data = this.toEntityFromUpdate(dto);
			const updated = await this.repository.update(projectId, data, manager);
			return this.toResponse(updated);
		});
	}

	async deletePortfolio(id: number, _college?: string) {
		await ProjectPortfolioValidation.validateDelete(this.repository, id);
		await this.repository.remove(id);
		return { success: true };
	}

	async getByIdPortfolio(id: number, _college?: string) {
		const entity = await this.repository.findOneById(id);
		if (!entity) throw new NotFoundException('Portafolio no encontrado');
		return this.toResponse(entity);
	}

	async getAllPaginated(paginator: PaginatedProjectPortfolioRequestDto) {
		const body = paginator?.body ?? ({} as FilterProjectPortfolioDto);
		const page = paginator?.page ?? ({} as PageDto);
		const { items, total, pageNumber, pageSize } = await this.repository.findByFilters(body, page);
		return {
			data: items.map((e) => this.toResponse(e)),
			resource: items.map((e) => this.toResponse(e)),
			total,
			pageNumber,
			pageSize,
		};
	}

	// %% =====================================================================
	// %%  CATÁLOGOS Y ACCESO (lógica completa pendiente, devuelve estructura compatible)
	// %% =====================================================================
	async getModalities(_college: string, _userId: number) {
		// TODO: implementar lectura de modalidades por usuario.
		// El sistema antiguo consulta una tabla externa por escuela.
		return [];
	}

	async getCareers(_college: string, _schoolId: number) {
		// TODO: implementar lectura real desde organization.schools / academic.programs.
		return [];
	}

	async getAccess(_college: string, _userId: number, _modalityId: number) {
		// TODO: implementar reglas de acceso al portafolio.
		return { hasAccess: false, role: null };
	}

	async listRoles(_college: string, _userId: number, _userSchool?: string) {
		// TODO: integrar con módulo de roles del usuario.
		return [];
	}

	// %% =====================================================================
	// %%  EMPRESAS / DOCENTES
	// %% =====================================================================
	async getCompanies(_college: string, academicPeriodId: number, modalityId: number) {
		const rows = await this.repository.findCompaniesByAcademicPeriodAndModality(academicPeriodId, modalityId);
		return rows;
	}

	async getTeachers(_college: string, _modalityId: number) {
		// TODO: integrar con `academic.professors` filtrando por modalidad.
		return [];
	}

	async getTotalTeacherProjects(_college: string, teacherId: number) {
		const total = await this.repository.countByTeacher(teacherId);
		return { total };
	}

	// %% =====================================================================
	// %%  OPERACIONES DE ESTUDIANTES Y MANAGER
	// %% =====================================================================
	async unassignStudent(_college: string, projectPortfolioId: number, studentId: number) {
		return await this.dataSource.transaction(async (manager: EntityManager) => {
			const updated = await this.repository.unassignStudent(projectPortfolioId, studentId, manager);
			return this.toResponse(updated);
		});
	}

	async updateManager(_college: string, dto: UpdateProjectPortfolioManagerDto) {
		return await this.dataSource.transaction(async (manager: EntityManager) => {
			const updated = await this.repository.updateManager(
				{
					projectId: dto.projectId,
					name: dto.name,
					description: dto.description,
					studentOneId: dto.studentOneId,
					studentTwoId: dto.studentTwoId,
					problemSolved: dto.problemSolved,
					goal: dto.goal,
					coautorId: dto.coautorId,
					consultantId: dto.consultantId,
				},
				manager,
			);
			return this.toResponse(updated);
		});
	}

	async autoAssignPartner(_college: string, _dto: AutoAssignPartnerDto) {
		// TODO: lógica de emparejamiento automático según matrícula activa.
		return { success: true, assigned: 0, message: 'feature.not.implemented' };
	}

	async managementAssign(_college: string, dto: ManagementAssignDto) {
		return await this.dataSource.transaction(async (manager: EntityManager) => {
			const updated = await this.repository.managementAssign(dto.projectId, dto.studentOneId, dto.studentTwoId, manager);
			return this.toResponse(updated);
		});
	}

	// %% =====================================================================
	// %%  EXCEL / BULK / EXPORT
	// %% =====================================================================
	async getBulkUploadTemplate() {
		const headers = ['Codigo', 'Nombre', 'Descripcion', 'ProblemaResuelto', 'Objetivo', 'EsUPC', 'CodigoEstudiante1', 'CodigoEstudiante2', 'CodigoEmpresa', 'CodigoCarrera'];
		const ws = XLSX.utils.aoa_to_sheet([headers]);
		const wb = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(wb, ws, 'Portafolios');
		const bytes = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
		return {
			Bytes: bytes,
			NombreArchivo: 'plantilla-portafolios.xlsx',
			Headers: headers,
		};
	}

	async getBulkUploadTemplateFile() {
		return await this.getBulkUploadTemplate();
	}

	async bulkUpload(_college: string, _periodoAcademicoId: number, _modalityId: number, _file: any) {
		// TODO: parsear excel y crear registros en transacción usando this.toEntityFromCreate.
		return { success: true, inserted: 0, errors: [], message: 'feature.not.implemented' };
	}

	async bulkUploadFilled(_college: string, _periodoAcademicoId: number, _modalityId: number, _courseCode: string, _file: any) {
		// TODO: parsear excel pre-llenado con asignaciones y aplicar.
		return { success: true, updated: 0, errors: [], message: 'feature.not.implemented' };
	}

	async export(paginator: PaginatedProjectPortfolioRequestDto) {
		const body = paginator?.body ?? ({} as FilterProjectPortfolioDto);
		const page: PageDto = paginator?.page ?? { pageNumber: -1, pageSize: -1 };
		const { items } = await this.repository.findByFilters(body, page);

		const rows = items.map((e) => ({
			Codigo: e.code,
			Nombre: e.name,
			Descripcion: e.description,
			Estado: e.status,
			Carrera: e.career_id,
			Modalidad: e.modality_id,
			PeriodoAcademico: e.academic_period_id,
			Empresa: e.company_code ?? e.company_id,
			EstudianteUno: e.student_one_id,
			EstudianteDos: e.student_two_id,
		}));
		const ws = XLSX.utils.json_to_sheet(rows);
		const wb = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(wb, ws, 'Portafolios');
		const bytes = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
		return { Bytes: bytes, NombreArchivo: 'portafolios-export.xlsx', Total: items.length };
	}

	// %% =====================================================================
	// %%  MIGRACIÓN
	// %% =====================================================================
	async migrate(_college: string, _dto: MigrateProjectPortfoliosDto) {
		// TODO: replicar portafolios desde un courseCode hacia newCourseCode dentro de transacción.
		return { success: true, migrated: 0, message: 'feature.not.implemented' };
	}

	async migrateFromDatabase(_college: string, _dto: MigrateFromDatabaseDto) {
		// TODO: replicar masivamente desde la BD origen (SQL Server) o desde otra fuente.
		return { success: true, migrated: 0, message: 'feature.not.implemented' };
	}
}
