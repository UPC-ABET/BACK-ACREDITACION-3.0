import { Injectable } from '@nestjs/common';
import { UPC_LOGO_DATA_URI } from 'src/libs/pdf-renderer.service';
import { REPORT_BASE_STYLES, REPORT_ORGANIZATION_NAME } from './report.theme';
import type { ReportDocument, ReportMetadataItem } from './report.types';
import { escapeHtml } from './report.utils';

@Injectable()
export class ReportHtmlService {
	build(document: ReportDocument): string {
		const orientation = document.orientation ?? 'portrait';
		const metadata = this.buildMetadata(document.metadata ?? []);
		const reportTitle = `${document.reportName} — ${document.programName}`;
		const logo = UPC_LOGO_DATA_URI
			? `<img class="report-header__logo" src="${UPC_LOGO_DATA_URI}" alt="UPC" />`
			: '';

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
						<h1>${escapeHtml(REPORT_ORGANIZATION_NAME)}</h1>
						${logo}
					</div>
					<div class="report-header__secondary">
						<h2>${escapeHtml(reportTitle)}</h2>
					</div>
					${metadata}
				</header>
				<main class="report-content">${document.bodyHtml}</main>
			</body>
			</html>
		`;
	}

	private buildMetadata(items: ReportMetadataItem[]): string {
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

		return `<div class="report-metadata">${content}</div>`;
	}
}
