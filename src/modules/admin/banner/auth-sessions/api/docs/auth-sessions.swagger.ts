import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { authSessionsRoutes } from '../../config/auth-sessions.routes';

const cfg = authSessionsRoutes.sessions;

export const SwaggerAuthSessionController = () =>
	ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerAuthSessionCreate = () => HttpMethodWithSwagger(cfg.operation.create);

export const SwaggerAuthSessionGet = () =>
	HttpMethodWithSwagger({
		...cfg.operation.get,
		param: { name: 'id', type: String, description: 'Login session id (uuid)' },
	});

export const SwaggerAuthSessionDelete = () =>
	HttpMethodWithSwagger({
		...cfg.operation.delete,
		param: { name: 'id', type: String, description: 'Login session id (uuid)' },
	});
