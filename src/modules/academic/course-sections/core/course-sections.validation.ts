import { BadRequestError, ConflictError, NotFoundError } from 'src/commons/domain-error';
import {
	CourseSectionRepository,
	CourseSectionDeleteBlockerCounts,
} from './course-sections.repository';
import { courseSectionsValidationStrings } from '../config/strings/course-sections.validation';
import {
	UpdateCourseSectionMaintenanceDto,
	CreateCourseSectionMaintenanceDto,
} from '../model/course-sections.dtos';

const DELETE_BLOCKER_KEYS: Array<[keyof CourseSectionDeleteBlockerCounts, string]> = [
	[
		'studentSectionEnrollments',
		courseSectionsValidationStrings.error.usedInStudentSectionEnrollments,
	],
	['surveys', courseSectionsValidationStrings.error.usedInSurveys],
];

export class CourseSectionValidation {
	static async validateCreate(repo: CourseSectionRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: {
				courseId: data.courseId,
				academicPeriodId: data.academicPeriodId,
				sectionCode: data.sectionCode,
			},
		});

		if (exists) errors.push(courseSectionsValidationStrings.error.sectionExists);

		if (errors.length > 0) {
			throw new BadRequestError({
				message: courseSectionsValidationStrings.result.createFailed,
				errors,
			});
		}
	}

	static async validateUpdate(repo: CourseSectionRepository, id: number, data: any) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) errors.push(courseSectionsValidationStrings.error.notFound);

		if (data.courseId && data.academicPeriodId && data.sectionCode) {
			const exists = await repo.findOneByCondition({
				where: {
					courseId: data.courseId,
					academicPeriodId: data.academicPeriodId,
					sectionCode: data.sectionCode,
				},
			});

			if (exists && exists.id !== id) {
				errors.push(courseSectionsValidationStrings.error.sectionExists);
			}
		}

		if (errors.length > 0) {
			throw new BadRequestError({
				message: courseSectionsValidationStrings.result.updateFailed,
				errors,
			});
		}
	}

	static async validateDelete(repo: CourseSectionRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new BadRequestError({
				message: courseSectionsValidationStrings.result.deleteFailed,
			});
		}
	}

	static async validateMaintenanceCreate(
		repo: CourseSectionRepository,
		academicPeriodId: number,
		data: CreateCourseSectionMaintenanceDto,
	) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: {
				courseId: data.courseId,
				academicPeriodId,
				sectionCode: data.sectionCode,
			},
		});
		if (exists) errors.push(courseSectionsValidationStrings.error.sectionExists);

		if (errors.length > 0) {
			throw new BadRequestError({
				message: courseSectionsValidationStrings.result.createFailed,
				errors,
			});
		}
	}

	static async validateMaintenanceUpdate(
		repo: CourseSectionRepository,
		id: number,
		data: UpdateCourseSectionMaintenanceDto,
	) {
		const entity = await repo.findOneById(id);
		if (!entity) {
			throw new NotFoundError({
				message: courseSectionsValidationStrings.result.updateFailed,
				errors: [courseSectionsValidationStrings.error.notFound],
			});
		}

		const courseId = data.courseId ?? entity.courseId;
		const sectionCode = data.sectionCode ?? entity.sectionCode;
		const codeOrCourseChanged =
			(data.courseId !== undefined && data.courseId !== entity.courseId) ||
			(data.sectionCode !== undefined && data.sectionCode !== entity.sectionCode);

		if (codeOrCourseChanged) {
			const exists = await repo.findOneByCondition({
				where: {
					courseId,
					academicPeriodId: entity.academicPeriodId,
					sectionCode,
				},
			});
			if (exists && exists.id !== id) {
				throw new BadRequestError({
					message: courseSectionsValidationStrings.result.updateFailed,
					errors: [courseSectionsValidationStrings.error.sectionExists],
				});
			}
		}
	}

	static async validateMaintenanceDelete(repo: CourseSectionRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new NotFoundError({
				message: courseSectionsValidationStrings.result.deleteFailed,
				errors: [courseSectionsValidationStrings.error.notFound],
			});
		}

		const counts = await repo.findDeleteBlockerCounts(id);
		const blockers = DELETE_BLOCKER_KEYS.filter(([key]) => counts[key] > 0).map(([, msg]) => msg);

		if (blockers.length > 0) {
			throw new ConflictError({
				message: courseSectionsValidationStrings.error.inUse,
				errors: blockers,
			});
		}
	}
}
