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
	/** Omits the series legend below the plot. Only affects the chart it's set on. */
	hideLegend?: boolean;
	/** Overrides the default overall chart width (viewBox units). */
	width?: number;
	/** Overrides the default plot area height (viewBox units), excluding legend/axis titles. */
	plotHeight?: number;
}
