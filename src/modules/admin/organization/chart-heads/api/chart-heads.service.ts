import { Injectable } from '@nestjs/common';

import { ChartHeadsRepository } from '../core/chart-heads.repository';
import { ChartHeadsValidation } from '../core/chart-heads.validation';
import { ChartHeadsConfigurationDto, ConfigureChartHeadsDto } from '../model/chart-heads.dtos';

@Injectable()
export class ChartHeadsService {
	constructor(private readonly repository: ChartHeadsRepository) {}

	async configure(dto: ConfigureChartHeadsDto): Promise<ChartHeadsConfigurationDto> {
		await ChartHeadsValidation.validateConfigure(this.repository, dto);
		await this.repository.configure(dto);
		return await this.repository.getConfiguration(dto.academicPeriodId);
	}

	async getConfiguration(academicPeriodId: number): Promise<ChartHeadsConfigurationDto> {
		return await this.repository.getConfiguration(academicPeriodId);
	}
}
