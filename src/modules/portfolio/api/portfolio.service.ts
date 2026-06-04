import { BadRequestException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { BaseService } from 'src/commons/base.service';
import { AcademicPeriodEntity } from 'src/modules/academic/academic-periods/model/academic-periods.entity';
import { ProfessorEntity } from 'src/modules/academic/professors/model/professors.entity';
import { ProgramEntity } from 'src/modules/academic/programs/model/programs.entity';
import { StudentEntity } from 'src/modules/academic/students/model/students.entity';
import { StudentSectionEnrollmentEntity } from 'src/modules/academic/student-section-enrollments/model/student-section-enrollments.entity';
import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';
import { PortfolioProjectApplicationRepository } from '../core/portfolio-project-application.repository';
import { PortfolioCompanyRepository } from '../core/portfolio-company.repository';
import { PortfolioRepository } from '../core/portfolio.repository';
import { PortfolioResearchLineRepository } from '../core/portfolio-research-line.repository';
import { PortfolioProjectApplicationEntity } from '../model/portfolio-project-application.entity';
import { PortfolioProjectEntity } from '../model/portfolio-project.entity';
import { PortfolioStatus } from '../enums/portfolio-status.enum';
import { CollaborationType } from '../enums/collaboration-type.enum';
import { PortfolioValidation } from '../core/portfolio.validation';
import { portfolioValidationStrings } from '../config/strings/portfolio.validation';
import {
	AutoAssignPartnerDto,
	CreatePortfolioProjectDto,
	FilterPortfolioProjectDto,
	ManagementAssignDto,
	MigratePortfolioProjectsDto,
	PageDto,
	PaginationResultDto,
	UpdatePortfolioManagerDto,
	UpdatePortfolioProjectDto,
} from '../model/portfolio.dtos';

@Injectable()
export class PortfolioService extends BaseService<PortfolioRepository> {
	constructor(
		protected readonly repository: PortfolioRepository,
		private readonly companyRepository: PortfolioCompanyRepository,
		private readonly researchLineRepository: PortfolioResearchLineRepository,
		private readonly applicationRepository: PortfolioProjectApplicationRepository,
		@InjectRepository(AcademicPeriodEntity)
		private readonly academicPeriodRepo: Repository<AcademicPeriodEntity>,
		@InjectRepository(StudentEntity)
		private readonly studentRepo: Repository<StudentEntity>,
		@InjectRepository(ProfessorEntity)
		private readonly professorRepo: Repository<ProfessorEntity>,
		@InjectRepository(ProgramEntity)
		private readonly programRepo: Repository<ProgramEntity>,
		@InjectRepository(StudentSectionEnrollmentEntity)
		private readonly enrollmentRepo: Repository<StudentSectionEnrollmentEntity>,
		private readonly dataSource: DataSource,
	) {
		super(repository);
	}

	// ── Helpers ───────────────────────────────────────────────────────────────

	private async resolveCompany(
		companyId: number | undefined,
		companyCode: string | undefined,
		academicPeriodId: number,
		modalityTypeId: number,
	) {
		if (companyId) {
			const company = await this.companyRepository.findOneById(companyId);
			if (!company) {
				throw new HttpException(
					{ message: portfolioValidationStrings.error.companyNotFoundById },
					HttpStatus.BAD_REQUEST,
				);
			}
			return company;
		}
		if (companyCode) {
			const company = await this.companyRepository.findByCodeAndPeriodAndModality(
				companyCode,
				academicPeriodId,
				modalityTypeId,
			);
			if (!company) {
				throw new HttpException(
					{ message: portfolioValidationStrings.error.companyNotFoundByCode },
					HttpStatus.BAD_REQUEST,
				);
			}
			return company;
		}
		throw new HttpException(
			{ message: portfolioValidationStrings.error.companyRequired },
			HttpStatus.BAD_REQUEST,
		);
	}

	private async generateCode(academicPeriodId: number): Promise<string> {
		return this.dataSource.transaction(async (manager) => {
			const period = await manager.findOne(AcademicPeriodEntity, {
				where: { id: academicPeriodId },
			});
			if (!period) {
				throw new NotFoundException(portfolioValidationStrings.error.periodNotFound);
			}
			const lastCode = await this.repository.findLastCodeByPeriod(academicPeriodId);
			return PortfolioValidation.generateProjectCode(lastCode, period.code);
		});
	}

	private async guardDelete(project: PortfolioProjectEntity): Promise<void> {
		const hasApplications = await this.applicationRepository.existsByProject(project.id);
		if (hasApplications) {
			throw new BadRequestException(portfolioValidationStrings.error.hasApplications);
		}
		await this.repository.remove(project.id);
	}

	private async resolveProgramIdsBySchoolId(schoolId: number): Promise<number[]> {
		const rows = await this.dataSource.query<{ programId: number }[]>(
			`
			WITH RECURSIVE school_tree AS (
				SELECT id, root_chart_id, entity_type_id, entity_code, 0 AS depth
				FROM "organization"."charts"
				WHERE entity_type_id = (SELECT id FROM "core"."types" WHERE code = $1)
				  AND entity_code = $2
				UNION ALL
				SELECT c.id, c.root_chart_id, c.entity_type_id, c.entity_code, st.depth + 1
				FROM "organization"."charts" c
				INNER JOIN school_tree st ON c.root_chart_id = st.id
				WHERE st.depth < 20
			)
			SELECT DISTINCT entity_code::int AS "programId"
			FROM school_tree
			WHERE entity_type_id = (SELECT id FROM "core"."types" WHERE code = $3)
			  AND entity_code IS NOT NULL
			`,
			[TYPE_CODES.ENTITY_TYPE.SCHOOL, schoolId, TYPE_CODES.ENTITY_TYPE.PROGRAM],
		);
		return rows.map((row) => row.programId);
	}

	// ── Queries ───────────────────────────────────────────────────────────────

	async getAllWithFilters(
		filters: FilterPortfolioProjectDto,
		page: PageDto,
	): Promise<PaginationResultDto<PortfolioProjectEntity>> {
		const qb = this.repository.createQueryBuilderWithRelations();

		if (filters.schoolId) {
			const programIds = await this.resolveProgramIdsBySchoolId(filters.schoolId);
			if (programIds.length === 0) {
				return { totalCount: 0, pageNumber: page.pageNumber, pageSize: page.pageSize, data: [] };
			}
			qb.andWhere('program.id IN (:...programIds)', { programIds });
		}

		if (filters.programId) {
			qb.andWhere('program.id = :programId', { programId: filters.programId });
		}

		if (filters.programIds?.length) {
			qb.andWhere('program.id IN (:...programIds)', { programIds: filters.programIds });
		}

		if (filters.academicPeriodId) {
			qb.andWhere('p.academicPeriodId = :academicPeriodId', {
				academicPeriodId: filters.academicPeriodId,
			});
		} else if (filters.modalityTypeId) {
			const activePeriod = await this.academicPeriodRepo
				.createQueryBuilder('ap')
				.where('ap.modalityTypeId = :modalityTypeId', { modalityTypeId: filters.modalityTypeId })
				.orderBy('ap.startDate', 'DESC')
				.getOne();
			if (activePeriod) {
				qb.andWhere('p.academicPeriodId = :academicPeriodId', {
					academicPeriodId: activePeriod.id,
				});
			}
		}

		if (filters.modalityTypeId) {
			qb.andWhere('p.modalityTypeId = :modalityTypeId', {
				modalityTypeId: filters.modalityTypeId,
			});
		}

		if (filters.status !== undefined) {
			qb.andWhere('p.status = :status', { status: filters.status });
		}

		if (filters.studentCode) {
			qb.andWhere('(studentOne.code = :code OR studentTwo.code = :code)', {
				code: filters.studentCode,
			});
		}

		if (filters.isFromUPC !== undefined) {
			qb.andWhere('p.isFromUPC = :isFromUPC', { isFromUPC: filters.isFromUPC });
		}

		if (filters.assignment === true) {
			qb.andWhere('p.studentOneId IS NULL AND p.studentTwoId IS NULL').andWhere((subQb) => {
				const sub = subQb
					.subQuery()
					.select('1')
					.from(PortfolioProjectApplicationEntity, 'app')
					.where('app.projectId = p.id')
					.getQuery();
				return `EXISTS ${sub}`;
			});
		} else if (filters.assignment === false) {
			qb.andWhere('(p.studentOneId IS NOT NULL OR p.studentTwoId IS NOT NULL)');
		}

		if (filters.courseSectionId) {
			qb.andWhere('p.courseSectionId = :courseSectionId', {
				courseSectionId: filters.courseSectionId,
			});
		}

		if (filters.teacherCode) {
			qb.andWhere(
				'(coauthorStaff.code = :teacherCode OR consultantStaff.code = :teacherCode)',
				{ teacherCode: filters.teacherCode },
			);
		}

		const totalCount = await qb.getCount();
		const data = await qb
			.skip((page.pageNumber - 1) * page.pageSize)
			.take(page.pageSize)
			.getMany();

		return { totalCount, pageNumber: page.pageNumber, pageSize: page.pageSize, data };
	}

	async getProjectById(id: number): Promise<PortfolioProjectEntity> {
		const project = await this.repository.findWithRelations(id);
		if (!project) throw new NotFoundException(portfolioValidationStrings.error.projectNotFound);
		return project;
	}

	async getCompaniesByPeriodAndModality(academicPeriodId: number, modalityTypeId: number) {
		return this.companyRepository.findByPeriodAndModality(academicPeriodId, modalityTypeId);
	}

	async getTotalTeacherProjects(
		professorId: number,
		modalityTypeId?: number,
	): Promise<{ coauthorTotal: number; consultantTotal: number }> {
		const baseQb = this.dataSource
			.getRepository(PortfolioProjectEntity)
			.createQueryBuilder('p');

		if (modalityTypeId) {
			baseQb.andWhere('p.modalityTypeId = :modalityTypeId', { modalityTypeId });
		}

		const coauthorTotal = await baseQb
			.clone()
			.andWhere('p.coauthorProfessorId = :professorId', { professorId })
			.getCount();

		const consultantTotal = await baseQb
			.clone()
			.andWhere('p.consultantProfessorId = :professorId', { professorId })
			.getCount();

		return { coauthorTotal, consultantTotal };
	}

	async getTeachersByModality(modalityTypeId: number) {
		const rows = await this.dataSource
			.getRepository(PortfolioProjectEntity)
			.createQueryBuilder('p')
			.leftJoinAndSelect('p.coauthorProfessor', 'coauth')
			.leftJoinAndSelect('coauth.staff', 'coauthStaff')
			.leftJoinAndSelect('p.consultantProfessor', 'consult')
			.leftJoinAndSelect('consult.staff', 'consultStaff')
			.where('p.modalityTypeId = :modalityTypeId', { modalityTypeId })
			.andWhere('(p.coauthorProfessorId IS NOT NULL OR p.consultantProfessorId IS NOT NULL)')
			.getMany();

		const map = new Map<
			string,
			{ professorId: number; fullName: string; type: CollaborationType; total: number }
		>();

		for (const p of rows) {
			if (p.coauthorProfessor) {
				const key = `${p.coauthorProfessor.id}-${CollaborationType.COAUTHOR}`;
				const entry = map.get(key) ?? {
					professorId: p.coauthorProfessor.id,
					fullName:
						`${p.coauthorProfessor.staff?.firstName ?? ''} ${p.coauthorProfessor.staff?.lastName ?? ''}`.trim(),
					type: CollaborationType.COAUTHOR,
					total: 0,
				};
				entry.total++;
				map.set(key, entry);
			}
			if (p.consultantProfessor) {
				const key = `${p.consultantProfessor.id}-${CollaborationType.CONSULTANT}`;
				const entry = map.get(key) ?? {
					professorId: p.consultantProfessor.id,
					fullName:
						`${p.consultantProfessor.staff?.firstName ?? ''} ${p.consultantProfessor.staff?.lastName ?? ''}`.trim(),
					type: CollaborationType.CONSULTANT,
					total: 0,
				};
				entry.total++;
				map.set(key, entry);
			}
		}

		return Array.from(map.values());
	}

	// ── Create ────────────────────────────────────────────────────────────────

	async createProject(dto: CreatePortfolioProjectDto): Promise<PortfolioProjectEntity> {
		PortfolioValidation.validateCreate(dto);

		const company = await this.resolveCompany(
			dto.companyId,
			dto.companyCode,
			dto.academicPeriodId,
			dto.modalityTypeId,
		);

		if (dto.studentOneId) {
			const student = await this.studentRepo.findOne({ where: { id: dto.studentOneId } });
			if (!student) {
				throw new BadRequestException(portfolioValidationStrings.error.studentOneNotFound);
			}
		}
		if (dto.studentTwoId) {
			const student = await this.studentRepo.findOne({ where: { id: dto.studentTwoId } });
			if (!student) {
				throw new BadRequestException(portfolioValidationStrings.error.studentTwoNotFound);
			}
		}

		const code = await this.generateCode(dto.academicPeriodId);
		const status = dto.isFromUPC ? PortfolioStatus.PRE_APPROVED : PortfolioStatus.PENDING;
		const goal = dto.isFromUPC ? dto.description : undefined;
		const problemSolved = dto.isFromUPC ? dto.description : undefined;

		const entity = await this.repository.create({
			code,
			name: dto.name,
			description: dto.description,
			goal,
			problemSolved,
			isFromUPC: dto.isFromUPC,
			status,
			studentOneId: dto.studentOneId,
			studentTwoId: dto.studentTwoId,
			academicPeriodId: dto.academicPeriodId,
			modalityTypeId: dto.modalityTypeId,
			companyId: company.id,
			programId: dto.programId,
			courseSectionId: dto.courseSectionId,
		});

		return (await this.repository.findWithRelations(entity.id))!;
	}

	// ── Update ────────────────────────────────────────────────────────────────

	async updateProject(
		id: number,
		dto: UpdatePortfolioProjectDto,
	): Promise<PortfolioProjectEntity | { message: string }> {
		PortfolioValidation.validateUpdate(dto);

		const project = await this.repository.findWithRelations(id);
		if (!project) throw new NotFoundException(portfolioValidationStrings.error.projectNotFound);

		const isFromUPC = dto.isFromUPC ?? project.isFromUPC;
		const studentOneId = dto.studentOneId !== undefined ? dto.studentOneId : project.studentOneId;
		const studentTwoId = dto.studentTwoId !== undefined ? dto.studentTwoId : project.studentTwoId;

		if (studentOneId == null && studentTwoId == null && !isFromUPC) {
			await this.guardDelete(project);
			return { message: portfolioValidationStrings.result.projectAutoDeleted };
		}

		let companyId = project.companyId;
		if (dto.companyId || dto.companyCode) {
			const company = await this.resolveCompany(
				dto.companyId,
				dto.companyCode,
				dto.academicPeriodId ?? project.academicPeriodId,
				dto.modalityTypeId ?? project.modalityTypeId,
			);
			companyId = company.id;
		}

		if (dto.coauthorProfessorId) {
			const prof = await this.professorRepo.findOne({
				where: { id: dto.coauthorProfessorId },
			});
			if (!prof) throw new BadRequestException(portfolioValidationStrings.error.coauthorNotFound);
		}
		if (dto.consultantProfessorId) {
			const prof = await this.professorRepo.findOne({
				where: { id: dto.consultantProfessorId },
			});
			if (!prof)
				throw new BadRequestException(portfolioValidationStrings.error.consultantNotFound);
		}

		await this.repository.update(id, {
			name: dto.name ?? project.name,
			description: dto.description ?? project.description,
			problemSolved: dto.problemSolved ?? project.problemSolved,
			goal: dto.goal ?? project.goal,
			isFromUPC,
			status: dto.status ?? project.status,
			studentOneId: studentOneId as number | undefined,
			studentTwoId: studentTwoId as number | undefined,
			academicPeriodId: dto.academicPeriodId ?? project.academicPeriodId,
			modalityTypeId: dto.modalityTypeId ?? project.modalityTypeId,
			companyId,
			researchLineId: dto.researchLineId ?? project.researchLineId,
			programId: dto.programId ?? project.programId,
			coauthorProfessorId: (dto.coauthorProfessorId !== undefined
				? dto.coauthorProfessorId
				: project.coauthorProfessorId) as number | undefined,
			consultantProfessorId: (dto.consultantProfessorId !== undefined
				? dto.consultantProfessorId
				: project.consultantProfessorId) as number | undefined,
			courseSectionId: dto.courseSectionId ?? project.courseSectionId,
		} as any);

		return (await this.repository.findWithRelations(id))!;
	}

	// ── Update Manager ────────────────────────────────────────────────────────

	async updateProjectManager(
		id: number,
		dto: UpdatePortfolioManagerDto,
	): Promise<PortfolioProjectEntity | { message: string }> {
		const project = await this.repository.findWithRelations(id);
		if (!project) throw new NotFoundException(portfolioValidationStrings.error.projectNotFound);

		const studentOneId = dto.studentOneId !== undefined ? dto.studentOneId : project.studentOneId;
		const studentTwoId = dto.studentTwoId !== undefined ? dto.studentTwoId : project.studentTwoId;

		if (studentOneId == null && studentTwoId == null && !project.isFromUPC) {
			await this.guardDelete(project);
			return { message: portfolioValidationStrings.result.projectAutoDeleted };
		}

		if (dto.coauthorProfessorId) {
			const prof = await this.professorRepo.findOne({
				where: { id: dto.coauthorProfessorId },
			});
			if (!prof) throw new BadRequestException(portfolioValidationStrings.error.coauthorNotFound);
		}
		if (dto.consultantProfessorId) {
			const prof = await this.professorRepo.findOne({
				where: { id: dto.consultantProfessorId },
			});
			if (!prof)
				throw new BadRequestException(portfolioValidationStrings.error.consultantNotFound);
		}

		await this.repository.update(id, {
			name: dto.name,
			description: dto.description ?? project.description,
			problemSolved: dto.problemSolved,
			goal: dto.goal,
			studentOneId: studentOneId as number | undefined,
			studentTwoId: studentTwoId as number | undefined,
			coauthorProfessorId: (dto.coauthorProfessorId !== undefined
				? dto.coauthorProfessorId
				: project.coauthorProfessorId) as number | undefined,
			consultantProfessorId: (dto.consultantProfessorId !== undefined
				? dto.consultantProfessorId
				: project.consultantProfessorId) as number | undefined,
		} as any);

		return (await this.repository.findWithRelations(id))!;
	}

	// ── Delete ────────────────────────────────────────────────────────────────

	async deleteProject(id: number): Promise<{ message: string }> {
		const project = await this.repository.findOneById(id);
		if (!project) throw new NotFoundException(portfolioValidationStrings.error.projectNotFound);

		await this.guardDelete(project);
		return { message: 'Portfolio project deleted successfully.' };
	}

	// ── Unassign student ──────────────────────────────────────────────────────

	async unassignStudent(
		projectId: number,
		studentId: number,
	): Promise<PortfolioProjectEntity | { message: string }> {
		const project = await this.repository.findWithRelations(projectId);
		if (!project) throw new NotFoundException(portfolioValidationStrings.error.projectNotFound);

		let studentOneId = project.studentOneId;
		let studentTwoId = project.studentTwoId;

		if (project.studentOneId === studentId) {
			studentOneId = undefined;
		} else if (project.studentTwoId === studentId) {
			studentTwoId = undefined;
		} else {
			throw new BadRequestException(portfolioValidationStrings.error.studentNotAssigned);
		}

		if (studentOneId == null && studentTwoId == null && !project.isFromUPC) {
			await this.guardDelete(project);
			return { message: portfolioValidationStrings.result.projectAutoDeleted };
		}

		await this.repository.update(projectId, { studentOneId, studentTwoId } as any);
		return (await this.repository.findWithRelations(projectId))!;
	}

	// ── Auto-assign partner ───────────────────────────────────────────────────

	async autoAssignPartner(dto: AutoAssignPartnerDto): Promise<{ assigned: number }> {
		const activePeriod = await this.academicPeriodRepo
			.createQueryBuilder('ap')
			.where('ap.modalityTypeId = :modalityTypeId', { modalityTypeId: dto.modalityTypeId })
			.orderBy('ap.startDate', 'DESC')
			.getOne();

		if (!activePeriod) {
			throw new NotFoundException(portfolioValidationStrings.error.noPeriodForModality);
		}

		const projectsWithOneStudent = await this.dataSource
			.getRepository(PortfolioProjectEntity)
			.createQueryBuilder('p')
			.where('p.academicPeriodId = :periodId', { periodId: activePeriod.id })
			.andWhere('p.courseSectionId = :courseSectionId', { courseSectionId: dto.courseSectionId })
			.andWhere(
				'((p.studentOneId IS NOT NULL AND p.studentTwoId IS NULL) OR (p.studentOneId IS NULL AND p.studentTwoId IS NOT NULL))',
			)
			.getMany();

		if (projectsWithOneStudent.length < 2) return { assigned: 0 };

		// Load enrollments with enrolledStudent relation to access StudentEntity.id via
		// StudentSectionEnrollmentEntity → EnrolledStudentEntity → StudentEntity
		const allEnrollments = await this.enrollmentRepo.find({
			where: { courseSectionId: dto.courseSectionId },
			relations: ['enrolledStudent'],
		});

		// Build a lookup: StudentEntity.id → courseSectionId
		const studentSectionMap = new Map<number, number>();
		for (const enrollment of allEnrollments) {
			if (enrollment.enrolledStudent?.studentId) {
				studentSectionMap.set(enrollment.enrolledStudent.studentId, enrollment.courseSectionId);
			}
		}

		const assignedStudentIds = new Set(
			projectsWithOneStudent.flatMap(
				(p) => [p.studentOneId, p.studentTwoId].filter(Boolean) as number[],
			),
		);

		let assigned = 0;

		for (const project of projectsWithOneStudent) {
			const existingStudentId = project.studentOneId ?? project.studentTwoId;
			if (!existingStudentId) continue;

			const existingSection = studentSectionMap.get(existingStudentId);
			if (!existingSection) continue;

			const partner = projectsWithOneStudent.find((other) => {
				if (other.id === project.id) return false;
				const otherStudentId = other.studentOneId ?? other.studentTwoId;
				if (!otherStudentId || assignedStudentIds.has(otherStudentId)) return false;
				return studentSectionMap.get(otherStudentId) === existingSection;
			});

			if (!partner) continue;

			const partnerId = partner.studentOneId ?? partner.studentTwoId!;

			if (project.studentOneId) {
				await this.repository.update(project.id, { studentTwoId: partnerId } as any);
			} else {
				await this.repository.update(project.id, { studentOneId: partnerId } as any);
			}

			assignedStudentIds.add(partnerId);
			assigned++;
		}

		return { assigned };
	}

	// ── Management assign ─────────────────────────────────────────────────────

	async managementAssign(dto: ManagementAssignDto): Promise<PortfolioProjectEntity> {
		const project = await this.repository.findOneById(dto.projectId);
		if (!project) throw new NotFoundException(portfolioValidationStrings.error.projectNotFound);

		const student1 = await this.studentRepo.findOne({ where: { id: dto.studentOneId } });
		if (!student1)
			throw new BadRequestException(portfolioValidationStrings.error.studentOneNotFound);

		if (dto.studentTwoId) {
			const student2 = await this.studentRepo.findOne({ where: { id: dto.studentTwoId } });
			if (!student2)
				throw new BadRequestException(portfolioValidationStrings.error.studentTwoNotFound);
		}

		await this.repository.update(dto.projectId, {
			studentOneId: dto.studentOneId,
			studentTwoId: dto.studentTwoId,
			courseSectionId: dto.courseSectionId ?? project.courseSectionId,
		} as any);

		return (await this.repository.findWithRelations(dto.projectId))!;
	}

	// ── Migrate projects ──────────────────────────────────────────────────────

	async migrateProjects(dto: MigratePortfolioProjectsDto): Promise<{ migrated: number }> {
		const originProjects = await this.dataSource.getRepository(PortfolioProjectEntity).find({
			where: {
				courseSectionId: dto.originCourseSectionId,
				modalityTypeId: dto.modalityTypeId,
			},
		});

		if (originProjects.length === 0) return { migrated: 0 };

		const newPeriod = await this.academicPeriodRepo.findOne({
			where: { id: dto.newAcademicPeriodId },
		});
		if (!newPeriod) {
			throw new NotFoundException(portfolioValidationStrings.error.periodNotFound);
		}

		let lastDestinationCode = await this.repository.findLastCodeByPeriod(dto.newAcademicPeriodId);

		const copies = originProjects.map((p) => {
			const code = PortfolioValidation.generateProjectCode(lastDestinationCode, newPeriod.code);
			lastDestinationCode = code;
			return {
				code,
				name: p.name,
				description: p.description,
				problemSolved: p.problemSolved,
				goal: p.goal,
				isFromUPC: p.isFromUPC,
				status: PortfolioStatus.PENDING,
				academicPeriodId: dto.newAcademicPeriodId,
				modalityTypeId: dto.modalityTypeId,
				companyId: p.companyId,
				programId: p.programId,
				courseSectionId: dto.destinationCourseSectionId,
				researchLineId: p.researchLineId,
			};
		});

		await this.dataSource.getRepository(PortfolioProjectEntity).save(copies);
		return { migrated: copies.length };
	}

	// ── Bulk upload ───────────────────────────────────────────────────────────

	async bulkUpload(
		academicPeriodId: number,
		modalityTypeId: number,
		file: Express.Multer.File,
	): Promise<{ success: boolean; errors: { row: number; message: string }[]; inserted: number }> {
		const workbook = new ExcelJS.Workbook();
		await workbook.xlsx.load(file.buffer as any);
		const ws = workbook.worksheets[0];

		const period = await this.academicPeriodRepo.findOne({ where: { id: academicPeriodId } });
		if (!period) throw new NotFoundException(portfolioValidationStrings.error.periodNotFound);

		const errors: { row: number; message: string }[] = [];
		const companyCache = new Map<string, number>();
		const programCache = new Map<string, number | null>();
		const inserted: Partial<PortfolioProjectEntity>[] = [];

		// Track the last generated code locally to avoid duplicate codes within the same batch
		let lastCode = await this.repository.findLastCodeByPeriod(academicPeriodId);

		for (let i = 2; i <= ws.rowCount; i++) {
			const row = ws.getRow(i);
			const name = String(row.getCell(1).value ?? '').trim();
			const description = String(row.getCell(2).value ?? '').trim();
			const programCode = String(row.getCell(3).value ?? '').trim();
			const companyCode = String(row.getCell(4).value ?? '').trim();

			if (!name || !description || !programCode || !companyCode) {
				errors.push({ row: i, message: 'All fields are required.' });
				continue;
			}

			if (!companyCache.has(companyCode)) {
				const c = await this.companyRepository.findByCodeAndPeriodAndModality(
					companyCode,
					academicPeriodId,
					modalityTypeId,
				);
				companyCache.set(companyCode, c?.id ?? 0);
			}
			if (!programCache.has(programCode)) {
				const prog = await this.programRepo.findOne({ where: { code: programCode } });
				programCache.set(programCode, prog?.id ?? null);
			}

			const companyId = companyCache.get(companyCode);
			const programId = programCache.get(programCode);

			if (!companyId) {
				errors.push({ row: i, message: `Company '${companyCode}' not found.` });
				continue;
			}
			if (!programId) {
				errors.push({ row: i, message: `Program '${programCode}' not found.` });
				continue;
			}

			const code = PortfolioValidation.generateProjectCode(lastCode, period.code);
			lastCode = code;

			inserted.push({
				code,
				name,
				description,
				goal: description,
				problemSolved: description,
				isFromUPC: true,
				status: PortfolioStatus.PRE_APPROVED,
				academicPeriodId,
				modalityTypeId,
				companyId,
				programId,
			});
		}

		if (inserted.length > 0) {
			await this.dataSource.getRepository(PortfolioProjectEntity).save(inserted);
		}

		return { success: errors.length === 0, errors, inserted: inserted.length };
	}

	async bulkUploadFilled(
		academicPeriodId: number,
		modalityTypeId: number,
		courseSectionId: number,
		file: Express.Multer.File,
	): Promise<{ success: boolean; errors: { row: number; message: string }[]; inserted: number }> {
		const workbook = new ExcelJS.Workbook();
		await workbook.xlsx.load(file.buffer as any);
		const ws = workbook.worksheets[0];

		const period = await this.academicPeriodRepo.findOne({ where: { id: academicPeriodId } });
		if (!period) throw new NotFoundException(portfolioValidationStrings.error.periodNotFound);

		const upcCompanyCode = modalityTypeId === 1 ? 'UPC' : 'UPC-EPE';
		const upcCompany = await this.companyRepository.findByCodeAndPeriodAndModality(
			upcCompanyCode,
			academicPeriodId,
			modalityTypeId,
		);

		const errors: { row: number; message: string }[] = [];
		const toInsert: Partial<PortfolioProjectEntity>[] = [];
		const seenCodes = new Set<string>();

		for (let i = 2; i <= ws.rowCount; i++) {
			const row = ws.getRow(i);
			const projectCode = String(row.getCell(1).value ?? '').trim();
			const studentCode1 = String(row.getCell(2).value ?? '').trim();
			const studentCode2 = String(row.getCell(3).value ?? '').trim();
			const title = String(row.getCell(4).value ?? '').trim();
			const problem = String(row.getCell(5).value ?? '').trim();
			const objective = String(row.getCell(6).value ?? '').trim();
			const researchLineName = String(row.getCell(7).value ?? '').trim();

			if (!projectCode || !studentCode1 || !title || !problem || !objective || !researchLineName) {
				errors.push({ row: i, message: 'Required fields are empty (student 2 is optional).' });
				continue;
			}

			if (seenCodes.has(projectCode)) {
				errors.push({ row: i, message: `Duplicate project code: ${projectCode}.` });
				continue;
			}

			const existingProject = await this.dataSource
				.getRepository(PortfolioProjectEntity)
				.findOne({ where: { code: projectCode } });
			if (existingProject) {
				errors.push({ row: i, message: `Project code already exists: ${projectCode}.` });
				continue;
			}

			const student1 = await this.studentRepo.findOne({ where: { code: studentCode1 } });
			if (!student1) {
				errors.push({ row: i, message: `Student 1 with code '${studentCode1}' not found.` });
				continue;
			}

			let student2Id: number | undefined;
			if (studentCode2) {
				const student2 = await this.studentRepo.findOne({ where: { code: studentCode2 } });
				if (!student2) {
					errors.push({ row: i, message: `Student 2 with code '${studentCode2}' not found.` });
					continue;
				}
				student2Id = student2.id;
			}

			let researchLine = await this.researchLineRepository.findByNameAndProgramAndModality(
				researchLineName,
				student1.programId,
				modalityTypeId,
			);
			if (!researchLine) {
				researchLine = await this.researchLineRepository.create({
					name: researchLineName,
					programId: student1.programId,
					modalityTypeId,
				});
			}

			seenCodes.add(projectCode);
			toInsert.push({
				code: projectCode,
				name: title,
				description: objective,
				problemSolved: problem,
				goal: objective,
				isFromUPC: false,
				status: PortfolioStatus.PRE_APPROVED,
				academicPeriodId,
				modalityTypeId,
				companyId: upcCompany?.id ?? 1,
				programId: student1.programId,
				courseSectionId,
				researchLineId: researchLine.id,
				studentOneId: student1.id,
				studentTwoId: student2Id,
			});
		}

		if (toInsert.length > 0) {
			await this.dataSource.getRepository(PortfolioProjectEntity).save(toInsert);
		}

		return { success: errors.length === 0, errors, inserted: toInsert.length };
	}

	// ── Export ────────────────────────────────────────────────────────────────

	async exportToExcel(
		filters: FilterPortfolioProjectDto,
	): Promise<{ bytes: Buffer; fileName: string }> {
		const all = await this.getAllWithFilters(filters, { pageNumber: 1, pageSize: 10_000 });
		const workbook = new ExcelJS.Workbook();
		const ws = workbook.addWorksheet('Portfolio');

		ws.addRow([
			'ID',
			'Code',
			'Name',
			'Description',
			'Status',
			'From UPC',
			'Student 1',
			'Student 2',
			'Program',
			'Company',
			'Academic Period',
			'Modality',
			'Co-author',
			'Consultant',
		]);

		const header = ws.getRow(1);
		header.font = { bold: true };
		header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } };

		for (const p of all.data) {
			ws.addRow([
				p.id,
				p.code,
				p.name,
				p.description ?? '',
				PortfolioStatus[p.status],
				p.isFromUPC ? 'Yes' : 'No',
				p.studentOne ? `${p.studentOne.firstName} ${p.studentOne.lastName}` : '',
				p.studentTwo ? `${p.studentTwo.firstName} ${p.studentTwo.lastName}` : '',
				p.program?.code ?? '',
				p.company?.name ?? '',
				p.academicPeriod?.code ?? '',
				p.modalityType?.id ?? '',
				p.coauthorProfessor
					? `${p.coauthorProfessor.staff?.firstName ?? ''} ${p.coauthorProfessor.staff?.lastName ?? ''}`.trim()
					: '',
				p.consultantProfessor
					? `${p.consultantProfessor.staff?.firstName ?? ''} ${p.consultantProfessor.staff?.lastName ?? ''}`.trim()
					: '',
			]);
		}

		ws.columns.forEach((col) => {
			col.width = 25;
		});

		const buffer = (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
		return { bytes: buffer, fileName: 'portfolio_export.xlsx' };
	}

	// ── Templates ─────────────────────────────────────────────────────────────

	async generateBulkUploadTemplate(): Promise<{ bytes: Buffer; fileName: string }> {
		const workbook = new ExcelJS.Workbook();
		const ws = workbook.addWorksheet('Sheet1');

		ws.addRow(['Project Name', 'Description', 'Program Code', 'Company Code']);
		const header = ws.getRow(1);
		header.font = { bold: true };
		header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } };
		ws.columns.forEach((col) => {
			col.width = 30;
		});

		const buffer = (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
		return { bytes: buffer, fileName: 'portfolio_bulk_upload_template.xlsx' };
	}

	async generateBulkUploadFilledTemplate(): Promise<{ bytes: Buffer; fileName: string }> {
		const workbook = new ExcelJS.Workbook();
		const ws = workbook.addWorksheet('Sheet1');

		ws.addRow([
			'Project Code',
			'Student 1 Code',
			'Student 2 Code',
			'Title',
			'Problem',
			'Objective',
			'Research Line',
		]);
		const header = ws.getRow(1);
		header.font = { bold: true };
		header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } };
		ws.columns.forEach((col) => {
			col.width = 30;
		});

		const buffer = (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
		return { bytes: buffer, fileName: 'portfolio_bulk_upload_filled_template.xlsx' };
	}

	// ── Companies CRUD ────────────────────────────────────────────────────────

	async createCompany(dto: {
		name: string;
		code: string;
		isFromUPC: boolean;
		academicPeriodId: number;
		modalityTypeId: number;
	}) {
		return this.companyRepository.create(dto);
	}

	// ── Research lines CRUD ───────────────────────────────────────────────────

	async createResearchLine(dto: { name: string; programId: number; modalityTypeId: number }) {
		return this.researchLineRepository.create(dto);
	}

	async getResearchLines(programId?: number, modalityTypeId?: number) {
		const where: any = {};
		if (programId) where.programId = programId;
		if (modalityTypeId) where.modalityTypeId = modalityTypeId;
		return this.researchLineRepository.findAll({ where });
	}

	// ── Applications ──────────────────────────────────────────────────────────

	async getApplicationsByProject(projectId: number) {
		return this.applicationRepository.findByProject(projectId);
	}

	async createApplication(projectId: number, studentId: number) {
		const project = await this.repository.findOneById(projectId);
		if (!project) throw new NotFoundException(portfolioValidationStrings.error.projectNotFound);

		const student = await this.studentRepo.findOne({ where: { id: studentId } });
		if (!student)
			throw new NotFoundException(portfolioValidationStrings.error.studentOneNotFound);

		const existing = await this.applicationRepository.findOneByCondition({
			where: { projectId, studentId },
		});
		if (existing) throw new BadRequestException(portfolioValidationStrings.error.applicationExists);

		return this.applicationRepository.create({ projectId, studentId } as any);
	}

	async deleteApplication(applicationId: number) {
		return this.applicationRepository.remove(applicationId);
	}
}
