import { BadRequestError } from 'src/commons/domain-error';
import { NotificationRepository } from './notifications.repository';
import { notificationsValidationStrings } from '../config/strings/notifications.validation';

export class NotificationValidation {
	static async validateCreate(repo: NotificationRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: {
				surveyTypeId: data.surveyTypeId,
				programId: data.programId,
				title: data.title,
			} as any,
		});

		if (exists) errors.push(notificationsValidationStrings.error.notificationExists);

		if (errors.length > 0) {
			throw new BadRequestError({
				message: notificationsValidationStrings.result.createFailed,
				errors,
			});
		}
	}

	static async validateUpdate(repo: NotificationRepository, id: number, data: any) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) errors.push(notificationsValidationStrings.error.notFound);

		const surveyTypeId = data.surveyTypeId ?? (entity as any)?.surveyTypeId;
		const programId = data.programId ?? (entity as any)?.programId;
		const title = data.title ?? (entity as any)?.title;

		const exists = await repo.findOneByCondition({
			where: {
				surveyTypeId: surveyTypeId,
				programId: programId,
				title,
			} as any,
		});

		if (exists && exists.id !== id) {
			errors.push(notificationsValidationStrings.error.notificationExists);
		}

		if (errors.length > 0) {
			throw new BadRequestError({
				message: notificationsValidationStrings.result.updateFailed,
				errors,
			});
		}
	}

	static async validateDelete(repo: NotificationRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new BadRequestError({
				message: notificationsValidationStrings.result.deleteFailed,
			});
		}
	}
}
