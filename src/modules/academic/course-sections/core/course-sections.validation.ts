import { HttpException, HttpStatus } from '@nestjs/common';
import { CourseSectionRepository } from './course-sections.repository';
import { courseSectionsValidationStrings } from '../config/strings/course-sections.validation';

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
			throw new HttpException(
				{
					message: courseSectionsValidationStrings.result.createFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
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
			throw new HttpException(
				{
					message: courseSectionsValidationStrings.result.updateFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateDelete(repo: CourseSectionRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new HttpException(
				{
					message: courseSectionsValidationStrings.result.deleteFailed,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}
}
