import { HttpException, HttpStatus } from '@nestjs/common';
import { NotificationLogRepository } from './notification-log.repository';
import { notificationLogValidationStrings } from '../config/strings/notification-log.validation';

export class NotificationLogValidation {
	static async validateCreate(_repo: NotificationLogRepository, _data: any) {
		// append-only log; no uniqueness checks
	}

	static async validateUpdate(repo: NotificationLogRepository, id: number, _data: any) {
		if (!(await repo.findOneById(id))) {
			throw new HttpException(
				{
					message: notificationLogValidationStrings.result.updateFailed,
					errors: [notificationLogValidationStrings.error.notFound],
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateDelete(repo: NotificationLogRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new HttpException(
				{
					message: notificationLogValidationStrings.result.deleteFailed,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}
}
