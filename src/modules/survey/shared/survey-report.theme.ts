import { REPORT_FONT_SIZE, REPORT_THEME } from 'src/libs/reporting/report.theme';

/**
 * One table look for every survey PDF — GRA, LCFC and PPP alike. Before this, each report
 * service carried its own header colours, alignment and count formatting, so the same figure
 * read differently depending on which report you opened.
 */
export const SURVEY_TABLE_STYLES = `
	table { width: 100%; border-collapse: collapse; }
	th, td { border: 1px solid #e4e4e7; padding: 5px 7px; vertical-align: middle; }
	thead th {
		background: ${REPORT_THEME.brandDark};
		color: #ffffff;
		font-size: ${REPORT_FONT_SIZE.dense};
		font-weight: 700;
		text-align: center;
	}
	td { font-size: ${REPORT_FONT_SIZE.compact}; text-align: left; }
	td.num, th.num { text-align: center; }
	/* Band columns keep the acceptance level's own colour as their header. */
	.band-cell { color: #ffffff; font-weight: 700; }
	/* The share sits under its count rather than beside it, so the counts stay scannable. */
	.count-share { display: block; font-size: ${REPORT_FONT_SIZE.small}; color: ${REPORT_THEME.mutedText}; }
	.totals-row td, tfoot td { background: #f1f1f1; font-weight: 700; }
`;

/** A count over its share of `total`, as the survey tables render every count. */
export function countWithShare(count: number, total: number): string {
	const percent = total > 0 ? (count / total) * 100 : 0;
	return `${count}<span class="count-share">(${percent.toFixed(2)}%)</span>`;
}
