import { HttpException, HttpStatus } from '@nestjs/common';
import { NotificationMessageRepository } from './notification-messages.repository';
import { notificationMessagesValidationStrings } from '../config/strings/notification-messages.validation';

export class NotificationMessageValidation {
	static async validateCreate(repo: NotificationMessageRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: {
				surveyTypeId: data.surveyTypeId,
				// null → "program_id IS NULL" (general template); a number matches that program.
				programId: data.programId ?? null,
			},
		});

		if (exists) errors.push(notificationMessagesValidationStrings.error.notificationMessageExists);

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: notificationMessagesValidationStrings.result.createFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateUpdate(repo: NotificationMessageRepository, id: number, data: any) {
		const errors: Array<string> = [];

		const entity = await repo.findOneById(id);
		if (!entity) errors.push(notificationMessagesValidationStrings.error.notFound);

		const surveyTypeId = data.surveyTypeId ?? entity?.surveyTypeId;
		const programId = data.programId ?? entity?.programId ?? null;

		const exists = await repo.findOneByCondition({
			where: {
				surveyTypeId: surveyTypeId,
				programId: programId,
			},
		});

		if (exists && exists.id !== id) {
			errors.push(notificationMessagesValidationStrings.error.notificationMessageExists);
		}

		if (errors.length > 0) {
			throw new HttpException(
				{
					message: notificationMessagesValidationStrings.result.updateFailed,
					errors,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	static async validateDelete(repo: NotificationMessageRepository, id: number) {
		if (!(await repo.findOneById(id))) {
			throw new HttpException(
				{
					message: notificationMessagesValidationStrings.result.deleteFailed,
				},
				HttpStatus.BAD_REQUEST,
			);
		}
	}
}
