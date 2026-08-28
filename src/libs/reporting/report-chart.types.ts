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
	/** Label under the category ticks describing what they represent (e.g. "Curso", "Outcome"). */
	xAxisLabel?: string;
	/** Renders one bar per category (not one per series) — for charts where at most one series is
	 *  ever non-zero per category. The legend still lists every series for the color key. */
	singleBarPerCategory?: boolean;
	emptyLabel?: string;
}
