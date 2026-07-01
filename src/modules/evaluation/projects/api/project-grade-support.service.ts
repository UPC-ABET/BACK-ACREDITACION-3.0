import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TypeEntity } from 'src/modules/core/types/model/types.entity';
import { projectsValidationStrings } from '../config/strings/projects.validation';
import { ProjectRepository } from '../core/projects.repository';

/**
 * Helpers shared across the project detail, listing and grade-export services:
 * grade-type/program resolution and the capstone grade scaling formula.
 */
@Injectable()
export class ProjectGradeSupportService {
	constructor(
		@InjectRepository(TypeEntity)
		private readonly typeRepo: Repository<TypeEntity>,
		private readonly projectRepository: ProjectRepository,
	) {}

	async resolveGradeTypeIdByCode(code: string): Promise<number> {
		const type = await this.typeRepo.findOne({ where: { code } });
		if (!type) {
			throw new BadRequestException(projectsValidationStrings.error.invalidGradeTypeCode);
		}
		return type.id;
	}

	async resolveEvaluationStageTypeIdByCode(code: string): Promise<number> {
		const type = await this.typeRepo.findOne({ where: { code } });
		if (!type) {
			throw new BadRequestException(projectsValidationStrings.error.invalidEvaluationStageCode);
		}
		return type.id;
	}

	async resolveCapstoneMaxScore(academicPeriodId: number, rubricId: number): Promise<number> {
		return await this.projectRepository.getCapstoneMaxLevelValue(academicPeriodId, rubricId);
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
