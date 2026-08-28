import { Injectable } from '@nestjs/common';
import { UPC_LOGO_DATA_URI } from 'src/libs/pdf-renderer.service';
import { REPORT_BASE_STYLES, REPORT_ORGANIZATION_NAME } from './report.theme';
import type { ReportDocument, ReportMetadataItem, ReportOrientation } from './report.types';
import { escapeHtml, fitFontSizePt } from './report.utils';

/** A4 minus the 12mm page margins and the 28px header padding, in points. */
const HEADER_WIDTH_PT: Record<ReportOrientation, number> = { portrait: 480, landscape: 725 };
const LOGO_WIDTH_PT = 60;

@Injectable()
export class ReportHtmlService {
	build(document: ReportDocument): string {
		const orientation = document.orientation ?? 'portrait';
		const metadata = this.buildMetadata(document.metadata ?? []);
		const secondaryMetadata = this.buildMetadata(document.secondaryMetadata ?? [], 'secondary');
		const reportTitle = `${document.reportName} — ${document.programName}`;
		const logo = UPC_LOGO_DATA_URI
			? `<img class="report-header__logo" src="${UPC_LOGO_DATA_URI}" alt="UPC" />`
			: '';

		const headerWidthPt = HEADER_WIDTH_PT[orientation];
		const organizationFontSizePt = fitFontSizePt(
			REPORT_ORGANIZATION_NAME,
			headerWidthPt - (logo ? LOGO_WIDTH_PT : 0),
			{ maxFontSizePt: 22, minFontSizePt: 11, glyphRatio: 0.6 },
		);
		const titleFontSizePt = fitFontSizePt(reportTitle, headerWidthPt, {
			maxFontSizePt: 17,
			minFontSizePt: 9,
			glyphRatio: 0.55,
		});

		return `
			<!doctype html>
			<html lang="${document.language}">
			<head>
				<meta charset="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<title>${escapeHtml(reportTitle)}</title>
				<style>
					@page { size: A4 ${orientation}; margin: 12mm; }
					${REPORT_BASE_STYLES}
					${document.additionalStyles ?? ''}
				</style>
			</head>
			<body>
				<header class="report-header">
					<div class="report-header__primary">
						<h1 style="font-size:${organizationFontSizePt}pt">${escapeHtml(REPORT_ORGANIZATION_NAME)}</h1>
						${logo}
					</div>
					<div class="report-header__secondary">
						<h2 style="font-size:${titleFontSizePt}pt">${escapeHtml(reportTitle)}</h2>
					</div>
					${metadata}
					${secondaryMetadata}
				</header>
				<main class="report-content">${document.bodyHtml}</main>
			</body>
			</html>
		`;
	}

	private buildMetadata(items: ReportMetadataItem[], variant?: 'secondary'): string {
		if (items.length === 0) return '';

		const content = items
			.map(
				(item) => `
					<div class="report-metadata__item">
						<span class="report-metadata__label">${escapeHtml(item.label)}</span>
						<span class="report-metadata__value">${escapeHtml(item.value ?? '—')}</span>
					</div>
				`,
			)
			.join('');

		const classes = ['report-metadata'];
		if (variant === 'secondary') {
			classes.push('report-metadata--secondary');
			if (items.length === 1) classes.push('report-metadata--single');
		}

		return `<div class="${classes.join(' ')}">${content}</div>`;
	}
}
