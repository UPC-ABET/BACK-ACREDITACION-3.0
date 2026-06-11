import { ControllerWithTags, HttpMethodWithSwagger } from 'src/commons/base.decorator';
import { chartHeadsRoutes } from '../../config/chart-heads.routes';
import { ChartHeadsConfigurationDto, ConfigureChartHeadsDto } from '../../model/chart-heads.dtos';

const cfg = chartHeadsRoutes.chartHeads;

export const SwaggerChartHeadsController = () =>
	ControllerWithTags({ tag: cfg.tag, route: cfg.route });

export const SwaggerChartHeadsConfigure = () =>
	HttpMethodWithSwagger({
		...cfg.operation.configure,
		body: ConfigureChartHeadsDto,
		responseType: ChartHeadsConfigurationDto,
	});

export const SwaggerChartHeadsGetByPeriod = () =>
	HttpMethodWithSwagger({
		...cfg.operation.getByPeriod,
		param: { name: 'academicPeriodId', type: Number },
		responseType: ChartHeadsConfigurationDto,
	});
