import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { s3Routes } from '../../config/s3.routes';

const cfg = s3Routes.s3;

export const SwaggerS3Controller = () => ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerS3Upload = () => HttpMethodWithSwagger({ ...cfg.operation.upload });

export const SwaggerS3GetSize = () =>
	HttpMethodWithSwagger({ ...cfg.operation.getSize, status: 200 });
