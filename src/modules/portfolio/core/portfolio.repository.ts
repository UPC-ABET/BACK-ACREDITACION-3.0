import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { PortfolioProjectEntity } from '../model/portfolio-project.entity';

@Injectable()
export class PortfolioRepository extends BaseRepository<PortfolioProjectEntity> {
	constructor(
		@InjectRepository(PortfolioProjectEntity)
		private readonly portfolioRepo: Repository<PortfolioProjectEntity>,
		dataSource: DataSource,
	) {
		super(portfolioRepo, dataSource);
	}

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

	createQueryBuilderWithRelations() {
		return this.portfolioRepo
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
	}
}
