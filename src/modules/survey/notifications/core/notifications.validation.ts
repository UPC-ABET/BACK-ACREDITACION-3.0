import { HttpException, HttpStatus } from '@nestjs/common';
import { NotificationRepository } from './notifications.repository';
import { notificationsValidationStrings } from '../config/strings/notifications.validation';

export class NotificationValidation {
	static async validateCreate(repo: NotificationRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: {
				survey_type_id: data.survey_type_id,
				program_id: data.program_id,
				title: data.title,
			} as any,
		});

		if (exists) errors.push(notificationsValidationStrings.error.notificationExists);

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: notificationsValidationStrings.result.createFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateUpdate(repo: NotificationRepository, id: number, data: any) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) errors.push(notificationsValidationStrings.error.notFound);

		const surveyTypeId = data.survey_type_id ?? (entity as any)?.survey_type_id;
		const programId = data.program_id ?? (entity as any)?.program_id;
		const title = data.title ?? (entity as any)?.title;

		const exists = await repo.findOneByCondition({
			where: {
				survey_type_id: surveyTypeId,
				program_id: programId,
				title,
			} as any,
		});

		if (exists && exists.id !== id) {
			errors.push(notificationsValidationStrings.error.notificationExists);
		}

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: notificationsValidationStrings.result.updateFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateDelete(repo: NotificationRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new HttpException(
				{
					message: notificationsValidationStrings.result.deleteFailed,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}
}
