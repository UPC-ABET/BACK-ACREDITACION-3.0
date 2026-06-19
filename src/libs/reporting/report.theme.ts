export const REPORT_ORGANIZATION_NAME = 'UNIVERSIDAD PERUANA DE CIENCIAS APLICADAS';

export const REPORT_THEME = {
	brand: '#e30613',
	brandDark: '#3a3a3c',
	text: '#18181b',
	mutedText: '#52525b',
	border: '#d4d4d8',
	surface: '#f4f4f5',
	white: '#ffffff',
} as const;

export const REPORT_BASE_STYLES = `
	* { box-sizing: border-box; }
	body {
		margin: 0;
		font-family: Arial, Helvetica, sans-serif;
		color: ${REPORT_THEME.text};
		font-size: 10pt;
	}
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
	}
	.report-header__logo {
		width: 58px;
		max-height: 58px;
		object-fit: contain;
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
	}
	.report-metadata {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
		gap: 14px;
		padding: 16px 28px;
	}
	.report-metadata__item {
		min-width: 0;
		text-align: center;
	}
	.report-metadata__label {
		display: block;
		margin-bottom: 5px;
		font-size: 8pt;
		font-weight: 700;
		text-transform: uppercase;
	}
	.report-metadata__value {
		display: block;
		color: ${REPORT_THEME.mutedText};
		font-size: 8.5pt;
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
		font-size: 12pt;
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
		font-size: 11pt;
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
