import { HttpException, HttpStatus } from '@nestjs/common';

import { chartHeadsValidationStrings } from '../config/strings/chart-heads.validation';
import type { ConfigureChartHeadsDto } from '../model/chart-heads.dtos';
import type { ChartHeadsRepository } from './chart-heads.repository';

export class ChartHeadsValidation {
	static async validateConfigure(
		repo: ChartHeadsRepository,
		dto: ConfigureChartHeadsDto,
	): Promise<void> {
		const errors: string[] = [];

		if (!(await repo.academicPeriodExists(dto.academicPeriodId))) {
			errors.push(chartHeadsValidationStrings.error.periodNotFound);
		}

		const schoolIds = dto.directors.map((d) => d.schoolId);
		if (new Set(schoolIds).size !== schoolIds.length) {
			errors.push(chartHeadsValidationStrings.error.duplicateSchoolInPayload);
		}

		const missingSchools = await repo.findMissingSchoolIds(schoolIds);
		if (missingSchools.length > 0) {
			errors.push(chartHeadsValidationStrings.error.schoolNotFound);
		}

		const userIds = [dto.dean.userId, ...dto.directors.map((d) => d.userId)].filter(
			(id): id is number => id !== undefined && id !== null,
		);
		const missingUsers = await repo.findMissingUserIds(userIds);
		if (missingUsers.length > 0) {
			errors.push(chartHeadsValidationStrings.error.userNotFound);
		}

		if (errors.length > 0) {
			throw new HttpException(
				{ message: chartHeadsValidationStrings.result.configureFailed, errors },
				HttpStatus.BAD_REQUEST,
			);
		}
	}
}
