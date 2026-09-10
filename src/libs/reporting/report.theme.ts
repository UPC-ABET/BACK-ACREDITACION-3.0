import type { ReportLanguage } from './report.types';

export const REPORT_ORGANIZATION_NAME = 'UNIVERSIDAD PERUANA DE CIENCIAS APLICADAS';

/** The program/career is no longer part of the banner title -- it rides in the metadata row
 *  below it, so it needs a label of its own. */
export const REPORT_PROGRAM_LABEL: Record<ReportLanguage, string> = {
	es: 'Carrera',
	en: 'Program',
};

export const REPORT_THEME = {
	brand: '#e30613',
	brandDark: '#3a3a3c',
	text: '#18181b',
	mutedText: '#52525b',
	border: '#d4d4d8',
	surface: '#f4f4f5',
	white: '#ffffff',
} as const;

/** The one type scale every PDF report draws from. Named by role, not by number, so a report
 *  reaching for "the size a section title uses" doesn't have to know it happens to be 12pt. */
export const REPORT_FONT_SIZE = {
	micro: '7.5pt',
	small: '8pt',
	dense: '8.5pt',
	compact: '9pt',
	base: '10pt',
	subheading: '11pt',
	sectionTitle: '12pt',
} as const;

export const REPORT_BASE_STYLES = `
	* { box-sizing: border-box; }
	body {
		margin: 0;
		font-family: Arial, Helvetica, sans-serif;
		color: ${REPORT_THEME.text};
		font-size: ${REPORT_FONT_SIZE.base};
	}
	/* Reports that lay out sections with plain semantic markup (<section>/<h3>/<h4>) share this
	   look instead of redeclaring it per report; a report using the .report-section* classes
	   below is free to ignore these. */
	section { break-inside: avoid; margin-top: 18px; }
	section h3 { color: ${REPORT_THEME.brand}; font-size: ${REPORT_FONT_SIZE.sectionTitle}; margin: 0 0 10px; }
	section h4 { font-size: ${REPORT_FONT_SIZE.subheading}; margin: 10px 0 6px; }
	.report-header__primary {
		min-height: 72px;
		padding: 18px 28px;
		background: ${REPORT_THEME.brand};
		color: ${REPORT_THEME.white};
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 20px;
	}
	.report-header__primary h1 {
		margin: 0;
		font-size: 22pt;
		line-height: 1.1;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.report-header__logo {
		width: 58px;
		max-height: 58px;
		object-fit: contain;
		opacity: 1;
		filter: brightness(0) invert(1);
	}
	.report-header__secondary {
		padding: 10px 28px;
		background: ${REPORT_THEME.brandDark};
		color: ${REPORT_THEME.white};
	}
	.report-header__secondary h2 {
		margin: 0;
		font-size: 17pt;
		line-height: 1.2;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.report-metadata {
		display: grid;
		/* 90px keeps six fields -- the career plus the five a PPP header can carry -- on a single
		   portrait row. */
		grid-template-columns: repeat(auto-fit, minmax(90px, 1fr));
		gap: 14px;
		padding: 16px 28px;
	}
	.report-metadata--secondary {
		display: flex;
		justify-content: center;
		flex-wrap: wrap;
		gap: 14px;
		padding: 0 28px 16px;
	}
	.report-metadata--secondary .report-metadata__item {
		flex: 0 1 auto;
		min-width: 110px;
	}
	.report-metadata--secondary.report-metadata--single .report-metadata__item {
		flex: 1 1 100%;
	}
	.report-metadata__item {
		min-width: 0;
		text-align: center;
	}
	.report-metadata__label {
		display: block;
		margin-bottom: 5px;
		font-size: ${REPORT_FONT_SIZE.small};
		font-weight: 700;
		text-transform: uppercase;
	}
	.report-metadata__value {
		display: block;
		color: ${REPORT_THEME.mutedText};
		font-size: ${REPORT_FONT_SIZE.dense};
		overflow-wrap: anywhere;
	}
	.report-content {
		padding: 10px 28px 24px;
	}
	.report-section {
		break-inside: avoid;
		margin-top: 18px;
	}
	.report-section__title {
		margin: 0 0 8px;
		color: ${REPORT_THEME.brand};
		font-size: ${REPORT_FONT_SIZE.sectionTitle};
	}
	table {
		width: 100%;
		border-collapse: collapse;
	}
	th, td {
		border: 1px solid ${REPORT_THEME.border};
		padding: 5px 7px;
		vertical-align: top;
	}
	th {
		background: ${REPORT_THEME.surface};
		font-weight: 700;
	}
	.report-empty {
		color: ${REPORT_THEME.mutedText};
		font-style: italic;
		text-align: center;
	}
	.report-chart {
		width: 100%;
		margin: 12px 0 20px;
		break-inside: avoid;
	}
	.report-chart svg {
		display: block;
		width: 100%;
		height: auto;
		overflow: visible;
	}
	.report-chart__title {
		margin: 0 0 4px;
		text-align: center;
		font-size: ${REPORT_FONT_SIZE.subheading};
	}
	.report-chart__grid {
		stroke: ${REPORT_THEME.border};
		stroke-width: 1;
	}
	.report-chart__axis {
		stroke: ${REPORT_THEME.text};
		stroke-width: 1.2;
	}
	.report-chart__axis-label,
	.report-chart__axis-title,
	.report-chart__category,
	.report-chart__legend {
		fill: ${REPORT_THEME.text};
		font-size: 12px;
	}
	.report-chart__value {
		fill: ${REPORT_THEME.text};
		font-size: 11px;
		font-weight: 700;
	}
	.report-chart--empty {
		padding: 24px;
		color: ${REPORT_THEME.mutedText};
		text-align: center;
	}
`;
