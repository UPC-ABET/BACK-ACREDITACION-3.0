import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { plannerSessionRoutes } from '../../config/planner-session.routes';
import { plannerSessionValidationStrings } from '../../config/strings/planner-session.validation';
import {
	PlannerCredentialsResponseDto,
	PlannerSessionStatusDto,
	SavePlannerCredentialsDto,
} from '../../model/planner-credentials.dtos';

const cfg = plannerSessionRoutes.session;

// Both endpoints that reach u-planner can answer 503. A frontend that only knows about 400 would
// report a correct password as rejected whenever u-planner is down, which is the misdiagnosis the
// whole rejected/unreachable split exists to prevent — so it has to be in the spec.
const unreachableResponse = () =>
	ApiResponse({ status: 503, description: plannerSessionValidationStrings.error.unreachable });

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
			'error.validation - the request body failed DTO validation',
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
