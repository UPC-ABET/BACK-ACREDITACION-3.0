import { BadRequestException, Injectable } from '@nestjs/common';
import { TypeRepository } from 'src/modules/core/types/core/types.repository';
import { projectsValidationStrings } from '../config/strings/projects.validation';
import { ProjectRepository } from '../core/projects.repository';

/**
 * Helpers shared across the project detail, listing and grade-export services:
 * grade-type/program resolution and the capstone grade scaling formula.
 */
@Injectable()
export class ProjectGradeSupportService {
	constructor(
		private readonly typeRepository: TypeRepository,
		private readonly projectRepository: ProjectRepository,
	) {}

	async resolveGradeTypeIdByCode(code: string): Promise<number> {
		const typeId = await this.typeRepository.findIdByCode(code);
		if (!typeId) {
			throw new BadRequestException(projectsValidationStrings.error.invalidGradeTypeCode);
		}
		return typeId;
	}

	async resolveCompetencyScopeTypeIdByCode(code: string): Promise<number> {
		const typeId = await this.typeRepository.findIdByCode(code);
		if (!typeId) {
			throw new BadRequestException(projectsValidationStrings.error.invalidCompetencyScopeCode);
		}
		return typeId;
	}

	async resolveCapstoneMaxScore(academicPeriodId: number, rubricId: number): Promise<number> {
		return await this.projectRepository.getCapstoneMaxLevelValue(academicPeriodId, rubricId);
	}

	async resolvePerformanceLevelUniqueValueMax(academicPeriodId: number): Promise<number> {
		return await this.projectRepository.getPerformanceLevelUniqueValueMax(academicPeriodId);
	}

	async resolveProgramIdsBySchoolId(schoolId: number): Promise<number[]> {
		return await this.projectRepository.getProgramIdsBySchoolId(schoolId);
	}

	computeGrade(sumScores: number, totalMaxScore: number): number {
		if (totalMaxScore > 0) {
			return Math.round(((sumScores * 20) / totalMaxScore) * 100) / 100;
		}
		return 0;
	}
}
