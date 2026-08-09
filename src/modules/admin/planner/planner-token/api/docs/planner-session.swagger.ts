import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { plannerSessionRoutes } from '../../config/planner-session.routes';
import { scraperCredentialsValidationStrings } from 'src/modules/admin/scraping/credentials/config/strings/scraper-credentials.validation';
import { plannerSessionValidationStrings } from '../../config/strings/planner-session.validation';
import {
	PlannerCredentialsResponseDto,
	PlannerSessionStatusDto,
	SavePlannerCredentialsDto,
} from '../../model/planner-credentials.dtos';

const cfg = plannerSessionRoutes.session;

// Two different keys share the 503, and only the key tells them apart: a frontend routing on status
// alone would report an APP_SECRET mismatch as "u-planner is down" and send the operator to
// re-enter credentials that were always correct.
const unreachableResponse = () =>
	ApiResponse({
		status: 503,
		description: [
			`${plannerSessionValidationStrings.error.unreachable} - u-planner did not answer`,
			`${scraperCredentialsValidationStrings.error.decryptionFailed} - the stored credential will not decrypt, usually a changed APP_SECRET`,
		].join('; '),
	});

// The 400 carries three unrelated meanings, and telling them apart is the difference between "your
// password is wrong" and "your last attempt is still running". Without them in the spec a frontend
// has no way to know `verificationCooldown` exists, and shows a rejected-password error for a
// double-clicked save.
const saveRejectionResponse = () =>
	ApiResponse({
		status: 400,
		description: [
			`${plannerSessionValidationStrings.error.invalidCredentials} - u-planner refused the pair`,
			`${plannerSessionValidationStrings.error.verificationCooldown} - a verification is in flight, or one was rejected in the last 30s; never a verdict on the submitted pair`,
			`${plannerSessionValidationStrings.error.invalidCredentialsPayload} - the body is malformed; details in data[]`,
			`${scraperCredentialsValidationStrings.result.saveFailed} - the pair is structurally unusable, e.g. a username that is only whitespace`,
		].join('; '),
	});

const refreshRejectionResponse = () =>
	ApiResponse({
		status: 400,
		description: `${plannerSessionValidationStrings.error.credentialsNotConfigured} - no Planner credentials have been saved yet`,
	});

export const SwaggerPlannerSessionController = () =>
	ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerPlannerSessionStatus = () =>
	HttpMethodWithSwagger({ ...cfg.operation.status, responseType: PlannerSessionStatusDto });

export const SwaggerPlannerSessionRefresh = () =>
	applyDecorators(
		HttpMethodWithSwagger({
			...cfg.operation.refresh,
			status: 200,
			responseType: PlannerSessionStatusDto,
		}),
		refreshRejectionResponse(),
		unreachableResponse(),
	);

export const SwaggerPlannerCredentialsGet = () =>
	HttpMethodWithSwagger({
		...cfg.operation.getCredentials,
		responseType: PlannerCredentialsResponseDto,
	});

export const SwaggerPlannerCredentialsSave = () =>
	applyDecorators(
		HttpMethodWithSwagger({
			...cfg.operation.saveCredentials,
			status: 200,
			body: SavePlannerCredentialsDto,
			responseType: PlannerSessionStatusDto,
		}),
		saveRejectionResponse(),
		unreachableResponse(),
	);
