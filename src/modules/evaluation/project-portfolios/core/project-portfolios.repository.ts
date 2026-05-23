import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { BaseRepostitory } from 'src/commons/base.repository';
import { ProjectPortfolioEntity } from '../model/project-portfolios.entity';
import { FilterProjectPortfolioDto, PageDto } from '../model/project-portfolios.dtos';

export interface PaginatedResult<T> {
	items: T[];
	total: number;
	pageNumber: number;
	pageSize: number;
}

export class ProjectPortfolioRepository extends BaseRepostitory {
	constructor(
		@InjectRepository(ProjectPortfolioEntity)
		repository: Repository<ProjectPortfolioEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}

	/**
	 * Aplica filtros y paginación contra la tabla `evaluation.project_portfolios`.
	 *
	 * Convención:
	 *  - pageNumber === -1 || pageSize === -1  ⇒  devuelve todo.
	 *  - resto ⇒ skip/take.
	 */
	async findByFilters(filters: FilterProjectPortfolioDto, page: PageDto): Promise<PaginatedResult<ProjectPortfolioEntity>> {
		const { repository, queryRunner } = await this.getRepository();
		try {
			const qb = repository.createQueryBuilder('pp').where('pp.is_active = :active', { active: true });

			if (filters?.periodoAcademicoId) {
				qb.andWhere('pp.academic_period_id = :apid', { apid: filters.periodoAcademicoId });
			}
			if (filters?.careerId) {
				qb.andWhere('pp.career_id = :cid', { cid: filters.careerId });
			}
			if (filters?.careersIds && filters.careersIds.length > 0) {
				qb.andWhere('pp.career_id IN (:...cids)', { cids: filters.careersIds });
			}
			if (filters?.status) {
				qb.andWhere('pp.status = :status', { status: filters.status });
			}
			if (filters?.isFromUPC !== undefined && filters.isFromUPC !== null) {
				qb.andWhere('pp.is_from_upc = :upc', { upc: filters.isFromUPC });
			}
			if (filters?.idModality) {
				qb.andWhere('pp.modality_id = :mid', { mid: filters.idModality });
			}
			if (filters?.assignment === true) {
				qb.andWhere('(pp.student_one_id IS NOT NULL OR pp.student_two_id IS NOT NULL)');
			} else if (filters?.assignment === false) {
				qb.andWhere('pp.student_one_id IS NULL AND pp.student_two_id IS NULL');
			}

			qb.orderBy('pp.id', 'DESC');

			const pageNumber = page?.pageNumber ?? 1;
			const pageSize = page?.pageSize ?? 10;
			const returnAll = pageNumber === -1 || pageSize === -1;

			const total = await qb.getCount();
			if (!returnAll) {
				qb.skip((pageNumber - 1) * pageSize).take(pageSize);
			}

			const items = await qb.getMany();
			return { items, total, pageNumber, pageSize };
		} finally {
			await queryRunner.release();
		}
	}

	async findByIdWithRelations(id: number) {
		const { repository, queryRunner } = await this.getRepository();
		try {
			return await repository.findOne({ where: { id } });
		} finally {
			await queryRunner.release();
		}
	}

	async findByStudent(studentId: number): Promise<ProjectPortfolioEntity[]> {
		const { repository, queryRunner } = await this.getRepository();
		try {
			return await repository.createQueryBuilder('pp').where('pp.student_one_id = :sid OR pp.student_two_id = :sid', { sid: studentId }).getMany();
		} finally {
			await queryRunner.release();
		}
	}

	async findByTeacher(teacherId: number): Promise<ProjectPortfolioEntity[]> {
		const { repository, queryRunner } = await this.getRepository();
		try {
			return await repository.createQueryBuilder('pp').where('pp.coauthor_id = :tid OR pp.consultant_id = :tid', { tid: teacherId }).getMany();
		} finally {
			await queryRunner.release();
		}
	}

	async findByAcademicPeriod(academicPeriodId: number): Promise<ProjectPortfolioEntity[]> {
		const { repository, queryRunner } = await this.getRepository();
		try {
			return await repository.find({ where: { academic_period_id: academicPeriodId } });
		} finally {
			await queryRunner.release();
		}
	}

	async findByCareerOrProgram(careerId: number): Promise<ProjectPortfolioEntity[]> {
		const { repository, queryRunner } = await this.getRepository();
		try {
			return await repository.find({ where: { career_id: careerId } });
		} finally {
			await queryRunner.release();
		}
	}

	async findByStatus(status: string): Promise<ProjectPortfolioEntity[]> {
		const { repository, queryRunner } = await this.getRepository();
		try {
			return await repository.find({ where: { status } });
		} finally {
			await queryRunner.release();
		}
	}

	async findCompaniesByAcademicPeriodAndModality(academicPeriodId: number, modalityId: number): Promise<Array<{ company_id: number; company_code: string | null }>> {
		const { repository, queryRunner } = await this.getRepository();
		try {
			const rows = await repository
				.createQueryBuilder('pp')
				.select('DISTINCT pp.company_id', 'company_id')
				.addSelect('pp.company_code', 'company_code')
				.where('pp.academic_period_id = :apid', { apid: academicPeriodId })
				.andWhere('pp.modality_id = :mid', { mid: modalityId })
				.andWhere('pp.company_id IS NOT NULL')
				.getRawMany();
			return rows;
		} finally {
			await queryRunner.release();
		}
	}

	async countByTeacher(teacherId: number): Promise<number> {
		const { repository, queryRunner } = await this.getRepository();
		try {
			return await repository.createQueryBuilder('pp').where('pp.coauthor_id = :tid OR pp.consultant_id = :tid', { tid: teacherId }).getCount();
		} finally {
			await queryRunner.release();
		}
	}

	async unassignStudent(projectPortfolioId: number, studentId: number, manager?: EntityManager): Promise<ProjectPortfolioEntity> {
		const { repository, queryRunner } = await this.getRepository(manager);
		try {
			const portfolio = await repository.findOne({ where: { id: projectPortfolioId } });
			if (!portfolio) {
				throw new Error(`Portafolio no encontrado: ${projectPortfolioId}`);
			}

			if (portfolio.student_one_id === studentId) {
				portfolio.student_one_id = null;
				portfolio.active_enrollment_student_one_id = null;
			}
			if (portfolio.student_two_id === studentId) {
				portfolio.student_two_id = null;
				portfolio.active_enrollment_student_two_id = null;
			}

			return await repository.save(portfolio);
		} finally {
			await queryRunner.release();
		}
	}

	async updateManager(
		data: { projectId: number; name: string; description?: string; studentOneId?: number; studentTwoId?: number; problemSolved: string; goal: string; coautorId?: number; consultantId?: number },
		manager?: EntityManager,
	): Promise<ProjectPortfolioEntity> {
		const { repository, queryRunner } = await this.getRepository(manager);
		try {
			const portfolio = await repository.findOne({ where: { id: data.projectId } });
			if (!portfolio) {
				throw new Error(`Portafolio no encontrado: ${data.projectId}`);
			}
			portfolio.name = data.name;
			if (data.description !== undefined) portfolio.description = data.description;
			if (data.studentOneId !== undefined) portfolio.student_one_id = data.studentOneId;
			if (data.studentTwoId !== undefined) portfolio.student_two_id = data.studentTwoId;
			portfolio.problem_solved = data.problemSolved;
			portfolio.goal = data.goal;
			if (data.coautorId !== undefined) portfolio.coauthor_id = data.coautorId;
			if (data.consultantId !== undefined) portfolio.consultant_id = data.consultantId;
			return await repository.save(portfolio);
		} finally {
			await queryRunner.release();
		}
	}

	async managementAssign(projectId: number, studentOneId?: number, studentTwoId?: number, manager?: EntityManager): Promise<ProjectPortfolioEntity> {
		const { repository, queryRunner } = await this.getRepository(manager);
		try {
			const portfolio = await repository.findOne({ where: { id: projectId } });
			if (!portfolio) {
				throw new Error(`Portafolio no encontrado: ${projectId}`);
			}
			if (studentOneId !== undefined) portfolio.student_one_id = studentOneId;
			if (studentTwoId !== undefined) portfolio.student_two_id = studentTwoId;
			return await repository.save(portfolio);
		} finally {
			await queryRunner.release();
		}
	}
}
