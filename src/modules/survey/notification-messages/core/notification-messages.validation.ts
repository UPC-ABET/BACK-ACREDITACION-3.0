import { HttpException, HttpStatus } from '@nestjs/common';
import { NotificationMessageRepository } from './notification-messages.repository';
import { notificationMessagesValidationStrings } from '../config/strings/notification-messages.validation';

export class NotificationMessageValidation {
	static async validateCreate(repo: NotificationMessageRepository, data: any) {
		const errors: Array<string> = [];

		const exists = await repo.findOneByCondition({
			where: {
				survey_type_id: data.survey_type_id,
				program_id: data.program_id,
				title: data.title,
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

		const surveyTypeId = data.survey_type_id ?? entity?.survey_type_id;
		const programId = data.program_id ?? entity?.program_id;
		const title = data.title ?? entity?.title;

		const exists = await repo.findOneByCondition({
			where: {
				survey_type_id: surveyTypeId,
				program_id: programId,
				title,
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
