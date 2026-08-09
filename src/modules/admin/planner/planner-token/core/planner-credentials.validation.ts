import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { BadRequestError } from 'src/commons/domain-error';
import { plannerSessionValidationStrings } from '../config/strings/planner-session.validation';
import { SavePlannerCredentialsDto } from '../model/planner-credentials.dtos';

/**
 * Parses the **raw** request body, because the global pipe cannot be trusted to for this endpoint.
 *
 * `main.ts` enables `transformOptions.enableImplicitConversion`, and class-transformer applies that
 * conversion *before* any `@Transform` or validator runs — verified: `{"password": {"a": 1}}`
 * reaches every later check as the string `"[object Object]"`. Route-scoped pipes cannot undo it
 * either, since Nest runs global pipes first. So the only place the real type still exists is the
 * untouched body, and this is the only thing that looks at it.
 *
 * It matters here more than elsewhere because this endpoint spends a live u-planner login attempt
 * on whatever it is given, and a failed attempt arms a throttle shared by every operator.
 */
export class PlannerCredentialsValidation {
	static parse(body: unknown): SavePlannerCredentialsDto {
		const dto = plainToInstance(SavePlannerCredentialsDto, body, {
			enableImplicitConversion: false,
		});

		const errors = validateSync(dto, {
			whitelist: true,
			forbidNonWhitelisted: true,
			forbidUnknownValues: true,
		});

		if (errors.length > 0) {
			throw new BadRequestError({
				message: plannerSessionValidationStrings.error.invalidCredentialsPayload,
				errors: errors.flatMap((error) => Object.values(error.constraints ?? {})),
			});
		}

		return dto;
	}
}
