import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { portfolioAccessRoutes } from '../../config/portfolio-access.routes';
import { UpdatePortfolioAccessDto } from '../../model/portfolio-access.dtos';

const cfg = portfolioAccessRoutes.access;

export const SwaggerPortfolioAccessController = () =>
	ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerPortfolioAccessGetMe = () =>
	HttpMethodWithSwagger({ ...cfg.operation.getMyAccess });

export const SwaggerPortfolioAccessGetUsers = () =>
	HttpMethodWithSwagger({ ...cfg.operation.getUsers });

export const SwaggerPortfolioAccessGetUser = () =>
	HttpMethodWithSwagger({
		...cfg.operation.getUserAccess,
		param: { name: 'userId', type: Number, description: 'User ID' },
	});

export const SwaggerPortfolioAccessUpdateUser = () =>
	HttpMethodWithSwagger({
		...cfg.operation.updateUserAccess,
		param: { name: 'userId', type: Number, description: 'User ID' },
		body: UpdatePortfolioAccessDto,
	});
