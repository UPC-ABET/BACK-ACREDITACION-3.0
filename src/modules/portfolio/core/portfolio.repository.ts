import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { AcademicPeriodEntity } from 'src/modules/academic/academic-periods/model/academic-periods.entity';
import { ProfessorEntity } from 'src/modules/academic/professors/model/professors.entity';
import { ProgramEntity } from 'src/modules/academic/programs/model/programs.entity';
import { StudentEntity } from 'src/modules/academic/students/model/students.entity';
import { StudentSectionEnrollmentEntity } from 'src/modules/academic/student-section-enrollments/model/student-section-enrollments.entity';
import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';
import { CollaborationType } from '../enums/collaboration-type.enum';
import { PortfolioProjectEntity } from '../model/portfolio-project.entity';
import { FilterPortfolioProjectDto, PageDto, PaginationResultDto } from '../model/portfolio.dtos';
import { PortfolioValidation } from './portfolio.validation';
import { PortfolioProjectApplicationEntity } from '../model/portfolio-project-application.entity';

@Injectable()
export class PortfolioRepository extends BaseRepository<PortfolioProjectEntity> {
	constructor(
		@InjectRepository(PortfolioProjectEntity)
		private readonly portfolioRepo: Repository<PortfolioProjectEntity>,
		dataSource: DataSource,
	) {
		super(portfolioRepo, dataSource);
	}

	// ── Basic finders ─────────────────────────────────────────────────────────

	async findLastCodeByPeriod(academicPeriodId: number): Promise<string | null> {
		const result = await this.portfolioRepo
			.createQueryBuilder('p')
			.select('p.code', 'code')
			.where('p.academicPeriodId = :academicPeriodId', { academicPeriodId })
			.orderBy('p.id', 'DESC')
			.limit(1)
			.getRawOne<{ code: string }>();

		return result?.code ?? null;
	}

	async findWithRelations(id: number): Promise<PortfolioProjectEntity | null> {
		return this.portfolioRepo.findOne({
			where: { id },
			relations: [
				'studentOne',
				'studentTwo',
				'academicPeriod',
				'modalityType',
				'company',
				'courseSection',
				'researchLine',
				'program',
				'coauthorProfessor',
				'coauthorProfessor.staff',
				'consultantProfessor',
				'consultantProfessor.staff',
				'studentOneEnrollment',
				'studentTwoEnrollment',
				'applications',
			],
		});
	}

	async findProjectsBySection(
		academicPeriodId: number,
		courseSectionId: number,
		onlyOneStudent: boolean,
	): Promise<PortfolioProjectEntity[]> {
		const qb = this.portfolioRepo
			.createQueryBuilder('p')
			.where('p.academicPeriodId = :periodId', { periodId: academicPeriodId })
			.andWhere('p.courseSectionId = :courseSectionId', { courseSectionId });

		if (onlyOneStudent) {
			qb.andWhere(
				'((p.studentOneId IS NOT NULL AND p.studentTwoId IS NULL) OR (p.studentOneId IS NULL AND p.studentTwoId IS NOT NULL))',
			);
		}

		return qb.getMany();
	}

	async findByPeriodAndSection(
		originCourseSectionId: number,
		modalityTypeId: number,
	): Promise<PortfolioProjectEntity[]> {
		return this.portfolioRepo.find({
			where: { courseSectionId: originCourseSectionId, modalityTypeId },
		});
	}

	async findByCode(code: string): Promise<PortfolioProjectEntity | null> {
		return this.portfolioRepo.findOne({ where: { code } });
	}

	// ── Cross-entity lookups (DB boundary) ────────────────────────────────────

	async findAcademicPeriodById(id: number): Promise<AcademicPeriodEntity | null> {
		return this.dataSource.getRepository(AcademicPeriodEntity).findOne({ where: { id } });
	}

	async findActivePeriodByModality(modalityTypeId: number): Promise<AcademicPeriodEntity | null> {
		return this.dataSource
			.getRepository(AcademicPeriodEntity)
			.createQueryBuilder('ap')
			.where('ap.modalityTypeId = :modalityTypeId', { modalityTypeId })
			.orderBy('ap.startDate', 'DESC')
			.getOne();
	}

	async findStudentById(id: number): Promise<StudentEntity | null> {
		return this.dataSource.getRepository(StudentEntity).findOne({ where: { id } });
	}

	async findStudentByCode(code: string): Promise<StudentEntity | null> {
		return this.dataSource.getRepository(StudentEntity).findOne({ where: { code } });
	}

	async findProfessorById(id: number): Promise<ProfessorEntity | null> {
		return this.dataSource.getRepository(ProfessorEntity).findOne({ where: { id } });
	}

	async findProgramByCode(code: string): Promise<ProgramEntity | null> {
		return this.dataSource.getRepository(ProgramEntity).findOne({ where: { code } });
	}

	async findEnrollmentsBySection(
		courseSectionId: number,
	): Promise<StudentSectionEnrollmentEntity[]> {
		return this.dataSource.getRepository(StudentSectionEnrollmentEntity).find({
			where: { courseSectionId },
			relations: ['enrolledStudent'],
		});
	}

	// ── Code generation in transaction ────────────────────────────────────────

	async generateCodeForPeriod(
		academicPeriodId: number,
	): Promise<{ code: string; periodFound: boolean }> {
		return this.dataSource.transaction(async (manager) => {
			const period = await manager.findOne(AcademicPeriodEntity, {
				where: { id: academicPeriodId },
			});
			if (!period) return { code: '', periodFound: false };
			const lastCode = await this.findLastCodeByPeriod(academicPeriodId);
			return {
				code: PortfolioValidation.generateProjectCode(lastCode, period.code),
				periodFound: true,
			};
		});
	}

	// ── Filters + pagination ──────────────────────────────────────────────────

	async findAllWithFilters(
		filters: FilterPortfolioProjectDto,
		page: PageDto,
		programIds?: number[],
	): Promise<PaginationResultDto<PortfolioProjectEntity>> {
		const qb = this.portfolioRepo
			.createQueryBuilder('p')
			.leftJoinAndSelect('p.studentOne', 'studentOne')
			.leftJoinAndSelect('p.studentTwo', 'studentTwo')
			.leftJoinAndSelect('p.academicPeriod', 'academicPeriod')
			.leftJoinAndSelect('p.modalityType', 'modalityType')
			.leftJoinAndSelect('p.company', 'company')
			.leftJoinAndSelect('p.courseSection', 'courseSection')
			.leftJoinAndSelect('p.researchLine', 'researchLine')
			.leftJoinAndSelect('p.program', 'program')
			.leftJoinAndSelect('p.coauthorProfessor', 'coauthorProfessor')
			.leftJoinAndSelect('coauthorProfessor.staff', 'coauthorStaff')
			.leftJoinAndSelect('p.consultantProfessor', 'consultantProfessor')
			.leftJoinAndSelect('consultantProfessor.staff', 'consultantStaff')
			.leftJoinAndSelect('p.applications', 'applications');

		if (programIds !== undefined) {
			if (programIds.length === 0) {
				return { totalCount: 0, pageNumber: page.pageNumber, pageSize: page.pageSize, data: [] };
			}
			qb.andWhere('program.id IN (:...programIds)', { programIds });
		}

		if (filters.programId) {
			qb.andWhere('program.id = :programId', { programId: filters.programId });
		}

		if (filters.programIds?.length) {
			qb.andWhere('program.id IN (:...filterProgramIds)', { filterProgramIds: filters.programIds });
		}

		if (filters.academicPeriodId) {
			qb.andWhere('p.academicPeriodId = :academicPeriodId', {
				academicPeriodId: filters.academicPeriodId,
			});
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
			qb.andWhere('(coauthorStaff.code = :teacherCode OR consultantStaff.code = :teacherCode)', {
				teacherCode: filters.teacherCode,
			});
		}

		const totalCount = await qb.getCount();
		const data = await qb
			.skip((page.pageNumber - 1) * page.pageSize)
			.take(page.pageSize)
			.getMany();

		return { totalCount, pageNumber: page.pageNumber, pageSize: page.pageSize, data };
	}

	// ── Teacher queries ───────────────────────────────────────────────────────

	async getTotalTeacherProjects(
		professorId: number,
		modalityTypeId?: number,
	): Promise<{ coauthorTotal: number; consultantTotal: number }> {
		const baseQb = this.portfolioRepo.createQueryBuilder('p');
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

	async getTeachersByModality(
		modalityTypeId: number,
	): Promise<{ professorId: number; fullName: string; type: CollaborationType; total: number }[]> {
		const rows = await this.portfolioRepo
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

	// ── School→program resolution ─────────────────────────────────────────────

	async findProgramIdsBySchoolId(schoolId: number): Promise<number[]> {
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

	// ── Bulk save ─────────────────────────────────────────────────────────────

	async saveMany(entities: Partial<PortfolioProjectEntity>[]): Promise<void> {
		await this.portfolioRepo.save(entities);
	}
}
