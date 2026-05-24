import { HttpException, HttpStatus } from '@nestjs/common';
import { ProjectStudentRepository } from './project-students.repository';
import { projectStudentsValidationStrings } from '../config/strings/project-students.validation';

export class ProjectStudentValidation {
	static async validateCreate(repo: ProjectStudentRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: {
				project_id: data.project_id,
				student_section_enrollment_id: data.student_section_enrollment_id,
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

		const projectId = data.project_id ?? entity?.project_id;
		const enrollmentId =
			data.student_section_enrollment_id ?? entity?.student_section_enrollment_id;

		const exists = await repo.findOneByCondition({
			where: {
				project_id: projectId,
				student_section_enrollment_id: enrollmentId,
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
