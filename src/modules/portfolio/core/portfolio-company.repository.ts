import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { PortfolioCompanyEntity } from '../model/portfolio-company.entity';

@Injectable()
export class PortfolioCompanyRepository extends BaseRepository<PortfolioCompanyEntity> {
	constructor(
		@InjectRepository(PortfolioCompanyEntity)
		private readonly companyRepo: Repository<PortfolioCompanyEntity>,
		dataSource: DataSource,
	) {
		super(companyRepo, dataSource);
	}

	async findByCodeAndPeriodAndModality(
		code: string,
		academicPeriodId: number,
		modalityTypeId: number,
	): Promise<PortfolioCompanyEntity | null> {
		return this.companyRepo.findOne({
			where: { code, academicPeriodId, modalityTypeId },
		});
	}

	async findByPeriodAndModality(
		academicPeriodId: number,
		modalityTypeId: number,
	): Promise<PortfolioCompanyEntity[]> {
		return this.companyRepo.find({
			where: { academicPeriodId, modalityTypeId },
			relations: ['academicPeriod', 'modalityType'],
		});
	}
}
