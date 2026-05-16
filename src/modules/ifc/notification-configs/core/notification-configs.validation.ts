import { HttpException, HttpStatus } from '@nestjs/common';
import { NotificationConfigRepository } from './notification-configs.repository';
import { notificationConfigsValidationStrings } from '../config/strings/notification-configs.validation';

export class NotificationConfigValidation {
	static async validateCreate(repo: NotificationConfigRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: {
				school_id: data.school_id,
				academic_period_id: data.academic_period_id,
				trigger_event_id: data.trigger_event_id,
				ifc_status_type_id: data.ifc_status_type_id,
			},
		});

		if (exists) errors.push(notificationConfigsValidationStrings.error.targetExists);

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: notificationConfigsValidationStrings.result.createFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateUpdate(repo: NotificationConfigRepository, id: number, data: any) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) errors.push(notificationConfigsValidationStrings.error.notFound);

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: notificationConfigsValidationStrings.result.updateFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateDelete(repo: NotificationConfigRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new HttpException(
				{
					message: notificationConfigsValidationStrings.result.deleteFailed,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}
}
