import { BadRequestError } from 'src/commons/domain-error';

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

		const allPrograms = dto.directors.flatMap((d) => d.programs ?? []);
		const programIds = allPrograms.map((p) => p.programId);
		if (new Set(programIds).size !== programIds.length) {
			errors.push(chartHeadsValidationStrings.error.duplicateProgramInPayload);
		}

		const missingPrograms = await repo.findMissingProgramIds(programIds);
		if (missingPrograms.length > 0) {
			errors.push(chartHeadsValidationStrings.error.programNotFound);
		}

		// Checked per director (excluding that director's own school): a program already active
		// under a different school must be rejected, not silently re-parented. upsertHead alone
		// cannot catch this — it only sees a repeat call for the same entity, not which school it
		// used to belong to.
		const programConflicts: number[] = [];
		for (const director of dto.directors) {
			const directorProgramIds = (director.programs ?? []).map((p) => p.programId);
			if (directorProgramIds.length === 0) continue;
			const conflicting = await repo.findProgramsConfiguredForOtherSchool(
				directorProgramIds,
				dto.academicPeriodId,
				director.schoolId,
			);
			programConflicts.push(...conflicting);
		}
		if (programConflicts.length > 0) {
			errors.push(chartHeadsValidationStrings.error.programAssignedToOtherSchool);
		}

		const staffIds = [
			dto.dean.staffId,
			...dto.directors.map((d) => d.staffId),
			...allPrograms.map((p) => p.staffId),
		];
		const missingStaff = await repo.findMissingStaffIds(staffIds);
		if (missingStaff.length > 0) {
			errors.push(chartHeadsValidationStrings.error.staffNotFound);
		}

		const userIds = [
			dto.dean.userId,
			...dto.directors.map((d) => d.userId),
			...allPrograms.map((p) => p.userId),
		].filter((id): id is number => id !== undefined && id !== null);
		const missingUsers = await repo.findMissingUserIds(userIds);
		if (missingUsers.length > 0) {
			errors.push(chartHeadsValidationStrings.error.userNotFound);
		}

		if (errors.length > 0) {
			throw new BadRequestError({
				message: chartHeadsValidationStrings.result.configureFailed,
				errors,
			});
		}
	}
}
