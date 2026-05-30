import { HttpException, HttpStatus } from '@nestjs/common';
import { ProjectStudentRepository } from './project-students.repository';
import { projectStudentsValidationStrings } from '../config/strings/project-students.validation';

export class ProjectStudentValidation {
	static async validateCreate(repo: ProjectStudentRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: {
				projectId: data.projectId,
				studentSectionEnrollmentId: data.studentSectionEnrollmentId,
			},
		});

		if (exists) errors.push(projectStudentsValidationStrings.error.projectStudentExists);

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: projectStudentsValidationStrings.result.createFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateUpdate(repo: ProjectStudentRepository, id: number, data: any) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) errors.push(projectStudentsValidationStrings.error.notFound);

		const projectId = data.projectId ?? entity?.projectId;
		const enrollmentId = data.studentSectionEnrollmentId ?? entity?.studentSectionEnrollmentId;

		const exists = await repo.findOneByCondition({
			where: {
				projectId: projectId,
				studentSectionEnrollmentId: enrollmentId,
			},
		});

		if (exists && exists.id !== id) {
			errors.push(projectStudentsValidationStrings.error.projectStudentExists);
		}

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: projectStudentsValidationStrings.result.updateFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateDelete(repo: ProjectStudentRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new HttpException(
				{
					message: projectStudentsValidationStrings.result.deleteFailed,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}
}
