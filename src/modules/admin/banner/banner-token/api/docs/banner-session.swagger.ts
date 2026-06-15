import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { bannerSessionRoutes } from '../../config/banner-session.routes';

const cfg = bannerSessionRoutes.session;

export const SwaggerBannerSessionController = () =>
	ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerBannerSessionStatus = () => HttpMethodWithSwagger(cfg.operation.status);

export const SwaggerBannerSessionRefresh = () => HttpMethodWithSwagger(cfg.operation.refresh);
