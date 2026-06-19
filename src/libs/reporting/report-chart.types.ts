export interface ReportChartSeries {
	label: string;
	color: string;
	values: number[];
}

export interface ReportBarChart {
	title?: string;
	categories: string[];
	series: ReportChartSeries[];
	yAxisLabel?: string;
	emptyLabel?: string;
}
