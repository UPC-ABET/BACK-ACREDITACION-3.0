import {
	BadRequestException,
	HttpException,
	HttpStatus,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { BaseService } from 'src/commons/base.service';
import { PortfolioProjectApplicationRepository } from '../core/portfolio-project-application.repository';
import { PortfolioCompanyRepository } from '../core/portfolio-company.repository';
import { PortfolioRepository } from '../core/portfolio.repository';
import { PortfolioResearchLineRepository } from '../core/portfolio-research-line.repository';
import { PortfolioProjectEntity } from '../model/portfolio-project.entity';
import { PortfolioProjectApplicationEntity } from '../model/portfolio-project-application.entity';
import { PortfolioStatus } from '../enums/portfolio-status.enum';
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
		const { code, periodFound } = await this.repository.generateCodeForPeriod(academicPeriodId);
		if (!periodFound) {
			throw new NotFoundException(portfolioValidationStrings.error.periodNotFound);
		}
		return code;
	}

	private async guardDelete(project: PortfolioProjectEntity): Promise<void> {
		const hasApplications = await this.applicationRepository.existsByProject(project.id);
		if (hasApplications) {
			throw new BadRequestException(portfolioValidationStrings.error.hasApplications);
		}
		await this.repository.remove(project.id);
	}

	// ── Queries ───────────────────────────────────────────────────────────────

	async getAllWithFilters(
		filters: FilterPortfolioProjectDto,
		page: PageDto,
	): Promise<PaginationResultDto<PortfolioProjectEntity>> {
		let programIds: number[] | undefined;

		if (filters.schoolId) {
			programIds = await this.repository.findProgramIdsBySchoolId(filters.schoolId);
		}

		if (!filters.academicPeriodId && filters.modalityTypeId) {
			const activePeriod = await this.repository.findActivePeriodByModality(filters.modalityTypeId);
			if (activePeriod) {
				filters = { ...filters, academicPeriodId: activePeriod.id };
			}
		}

		return this.repository.findAllWithFilters(filters, page, programIds);
	}

	async getProjectById(id: number): Promise<PortfolioProjectEntity> {
		const project = await this.repository.findWithRelations(id);
		if (!project) throw new NotFoundException(portfolioValidationStrings.error.projectNotFound);
		return project;
	}

	async getCompaniesByPeriodAndModality(academicPeriodId: number, modalityTypeId: number) {
		return this.companyRepository.findByPeriodAndModality(academicPeriodId, modalityTypeId);
	}

	async getTotalTeacherProjects(professorId: number, modalityTypeId?: number) {
		return this.repository.getTotalTeacherProjects(professorId, modalityTypeId);
	}

	async getTeachersByModality(modalityTypeId: number) {
		return this.repository.getTeachersByModality(modalityTypeId);
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
			const student = await this.repository.findStudentById(dto.studentOneId);
			if (!student)
				throw new BadRequestException(portfolioValidationStrings.error.studentOneNotFound);
		}
		if (dto.studentTwoId) {
			const student = await this.repository.findStudentById(dto.studentTwoId);
			if (!student)
				throw new BadRequestException(portfolioValidationStrings.error.studentTwoNotFound);
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
			const prof = await this.repository.findProfessorById(dto.coauthorProfessorId);
			if (!prof) throw new BadRequestException(portfolioValidationStrings.error.coauthorNotFound);
		}
		if (dto.consultantProfessorId) {
			const prof = await this.repository.findProfessorById(dto.consultantProfessorId);
			if (!prof) throw new BadRequestException(portfolioValidationStrings.error.consultantNotFound);
		}

		await this.repository.update(id, {
			name: dto.name ?? project.name,
			description: dto.description ?? project.description,
			problemSolved: dto.problemSolved ?? project.problemSolved,
			goal: dto.goal ?? project.goal,
			isFromUPC,
			status: dto.status ?? project.status,
			studentOneId: studentOneId ?? undefined,
			studentTwoId: studentTwoId ?? undefined,
			academicPeriodId: dto.academicPeriodId ?? project.academicPeriodId,
			modalityTypeId: dto.modalityTypeId ?? project.modalityTypeId,
			companyId,
			researchLineId: dto.researchLineId ?? project.researchLineId,
			programId: dto.programId ?? project.programId,
			coauthorProfessorId:
				dto.coauthorProfessorId !== undefined
					? (dto.coauthorProfessorId ?? undefined)
					: project.coauthorProfessorId,
			consultantProfessorId:
				dto.consultantProfessorId !== undefined
					? (dto.consultantProfessorId ?? undefined)
					: project.consultantProfessorId,
			courseSectionId: dto.courseSectionId ?? project.courseSectionId,
		} as Partial<PortfolioProjectEntity>);

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
			const prof = await this.repository.findProfessorById(dto.coauthorProfessorId);
			if (!prof) throw new BadRequestException(portfolioValidationStrings.error.coauthorNotFound);
		}
		if (dto.consultantProfessorId) {
			const prof = await this.repository.findProfessorById(dto.consultantProfessorId);
			if (!prof) throw new BadRequestException(portfolioValidationStrings.error.consultantNotFound);
		}

		await this.repository.update(id, {
			name: dto.name,
			description: dto.description ?? project.description,
			problemSolved: dto.problemSolved,
			goal: dto.goal,
			studentOneId: studentOneId ?? undefined,
			studentTwoId: studentTwoId ?? undefined,
			coauthorProfessorId:
				dto.coauthorProfessorId !== undefined
					? (dto.coauthorProfessorId ?? undefined)
					: project.coauthorProfessorId,
			consultantProfessorId:
				dto.consultantProfessorId !== undefined
					? (dto.consultantProfessorId ?? undefined)
					: project.consultantProfessorId,
		} as Partial<PortfolioProjectEntity>);

		return (await this.repository.findWithRelations(id))!;
	}

	// ── Delete ────────────────────────────────────────────────────────────────

	async deleteProject(id: number): Promise<{ message: string }> {
		const project = await this.repository.findOneById(id);
		if (!project) throw new NotFoundException(portfolioValidationStrings.error.projectNotFound);

		await this.guardDelete(project);
		return { message: portfolioValidationStrings.result.deleteSucceeded };
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

		await this.repository.update(projectId, {
			studentOneId,
			studentTwoId,
		} as Partial<PortfolioProjectEntity>);
		return (await this.repository.findWithRelations(projectId))!;
	}

	// ── Auto-assign partner ───────────────────────────────────────────────────

	async autoAssignPartner(dto: AutoAssignPartnerDto): Promise<{ assigned: number }> {
		const activePeriod = await this.repository.findActivePeriodByModality(dto.modalityTypeId);
		if (!activePeriod) {
			throw new NotFoundException(portfolioValidationStrings.error.noPeriodForModality);
		}

		const projectsWithOneStudent = await this.repository.findProjectsBySection(
			activePeriod.id,
			dto.courseSectionId,
			true,
		);

		if (projectsWithOneStudent.length < 2) return { assigned: 0 };

		const allEnrollments = await this.repository.findEnrollmentsBySection(dto.courseSectionId);

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
				await this.repository.update(project.id, {
					studentTwoId: partnerId,
				} as Partial<PortfolioProjectEntity>);
			} else {
				await this.repository.update(project.id, {
					studentOneId: partnerId,
				} as Partial<PortfolioProjectEntity>);
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

		const student1 = await this.repository.findStudentById(dto.studentOneId);
		if (!student1)
			throw new BadRequestException(portfolioValidationStrings.error.studentOneNotFound);

		if (dto.studentTwoId) {
			const student2 = await this.repository.findStudentById(dto.studentTwoId);
			if (!student2)
				throw new BadRequestException(portfolioValidationStrings.error.studentTwoNotFound);
		}

		await this.repository.update(dto.projectId, {
			studentOneId: dto.studentOneId,
			studentTwoId: dto.studentTwoId,
			courseSectionId: dto.courseSectionId ?? project.courseSectionId,
		} as Partial<PortfolioProjectEntity>);

		return (await this.repository.findWithRelations(dto.projectId))!;
	}

	// ── Migrate projects ──────────────────────────────────────────────────────

	async migrateProjects(dto: MigratePortfolioProjectsDto): Promise<{ migrated: number }> {
		const originProjects = await this.repository.findByPeriodAndSection(
			dto.originCourseSectionId,
			dto.modalityTypeId,
		);

		if (originProjects.length === 0) return { migrated: 0 };

		const newPeriod = await this.repository.findAcademicPeriodById(dto.newAcademicPeriodId);
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

		await this.repository.saveMany(copies);
		return { migrated: copies.length };
	}

	// ── Bulk upload ───────────────────────────────────────────────────────────

	async bulkUpload(
		academicPeriodId: number,
		modalityTypeId: number,
		file: Express.Multer.File,
	): Promise<{ success: boolean; errors: { row: number; message: string }[]; inserted: number }> {
		const workbook = new ExcelJS.Workbook();
		await workbook.xlsx.load(file.buffer as unknown as ArrayBuffer);
		const ws = workbook.worksheets[0];

		const period = await this.repository.findAcademicPeriodById(academicPeriodId);
		if (!period) throw new NotFoundException(portfolioValidationStrings.error.periodNotFound);

		const errors: { row: number; message: string }[] = [];
		const companyCache = new Map<string, number>();
		const programCache = new Map<string, number | null>();
		const inserted: Partial<PortfolioProjectEntity>[] = [];

		let lastCode = await this.repository.findLastCodeByPeriod(academicPeriodId);

		for (let i = 2; i <= ws.rowCount; i++) {
			const row = ws.getRow(i);
			const name = String(row.getCell(1).value ?? '').trim();
			const description = String(row.getCell(2).value ?? '').trim();
			const programCode = String(row.getCell(3).value ?? '').trim();
			const companyCode = String(row.getCell(4).value ?? '').trim();

			if (!name || !description || !programCode || !companyCode) {
				errors.push({ row: i, message: 'error.portfolio.bulkUpload.fieldsRequired' });
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
				const prog = await this.repository.findProgramByCode(programCode);
				programCache.set(programCode, prog?.id ?? null);
			}

			const companyId = companyCache.get(companyCode);
			const programId = programCache.get(programCode);

			if (!companyId) {
				errors.push({ row: i, message: 'error.portfolio.bulkUpload.companyNotFound' });
				continue;
			}
			if (!programId) {
				errors.push({ row: i, message: 'error.portfolio.bulkUpload.programNotFound' });
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
			await this.repository.saveMany(inserted);
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
		await workbook.xlsx.load(file.buffer as unknown as ArrayBuffer);
		const ws = workbook.worksheets[0];

		const period = await this.repository.findAcademicPeriodById(academicPeriodId);
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
				errors.push({ row: i, message: 'error.portfolio.bulkUpload.filledFieldsRequired' });
				continue;
			}

			if (seenCodes.has(projectCode)) {
				errors.push({ row: i, message: 'error.portfolio.bulkUpload.duplicateCode' });
				continue;
			}

			const existingProject = await this.repository.findByCode(projectCode);
			if (existingProject) {
				errors.push({ row: i, message: 'error.portfolio.bulkUpload.codeExists' });
				continue;
			}

			const student1 = await this.repository.findStudentByCode(studentCode1);
			if (!student1) {
				errors.push({ row: i, message: 'error.portfolio.bulkUpload.student1NotFound' });
				continue;
			}

			let student2Id: number | undefined;
			if (studentCode2) {
				const student2 = await this.repository.findStudentByCode(studentCode2);
				if (!student2) {
					errors.push({ row: i, message: 'error.portfolio.bulkUpload.student2NotFound' });
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
			await this.repository.saveMany(toInsert);
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

		const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
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
		const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
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
		const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
		return { bytes: buffer, fileName: 'portfolio_bulk_upload_filled_template.xlsx' };
	}

	// ── Companies ─────────────────────────────────────────────────────────────

	async createCompany(dto: {
		name: string;
		code: string;
		isFromUPC: boolean;
		academicPeriodId: number;
		modalityTypeId: number;
	}) {
		return this.companyRepository.create(dto);
	}

	// ── Research lines ────────────────────────────────────────────────────────

	async createResearchLine(dto: { name: string; programId: number; modalityTypeId: number }) {
		return this.researchLineRepository.create(dto);
	}

	async getResearchLines(programId?: number, modalityTypeId?: number) {
		const where: Partial<{ programId: number; modalityTypeId: number }> = {};
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

		const student = await this.repository.findStudentById(studentId);
		if (!student) throw new NotFoundException(portfolioValidationStrings.error.studentOneNotFound);

		const existing = await this.applicationRepository.findOneByCondition({
			where: { projectId, studentId },
		});
		if (existing) throw new BadRequestException(portfolioValidationStrings.error.applicationExists);

		return this.applicationRepository.create({
			projectId,
			studentId,
		} as Partial<PortfolioProjectApplicationEntity>);
	}

	async deleteApplication(applicationId: number) {
		return this.applicationRepository.remove(applicationId);
	}
}
