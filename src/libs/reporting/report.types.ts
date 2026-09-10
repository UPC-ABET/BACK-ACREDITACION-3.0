export type ReportLanguage = 'es' | 'en';
export type ReportOrientation = 'portrait' | 'landscape';

export interface ReportMetadataItem {
	label: string;
	value: string | number | null | undefined;
}

export type ReportFilterSelectionMode = 'single' | 'multiple';

export interface ReportFilterOption<TValue extends string | number = number> {
	value: TValue;
	label: string;
}

export interface ReportFilterDefinition<TValue extends string | number = number> {
	key: string;
	label: string;
	selectionMode: ReportFilterSelectionMode;
	required: boolean;
	allowAll?: boolean;
	dependsOn?: string[];
	options?: ReportFilterOption<TValue>[];
	optionsRoute?: string;
}

export interface ReportDocument {
	language: ReportLanguage;
	/** Shown alone in the dark banner. */
	reportName: string;
	/** Rendered as the first item of the `metadata` row, labelled Carrera/Program. Pass '' when
	 *  the module lists the career among its own `metadata` items instead. */
	programName: string;
	metadata?: ReportMetadataItem[];
	/** Rendered as its own row below `metadata` — centered as a group, or full-width when it's a
	 *  single item (e.g. a course/NRC/professor line that only sometimes applies). */
	secondaryMetadata?: ReportMetadataItem[];
	bodyHtml: string;
	orientation?: ReportOrientation;
	additionalStyles?: string;
}

export interface GeneratedPdfReport {
	pdf: Buffer;
	filename: string;
}

export interface PdfReportDefinition<TContext> {
	buildDocument(context: TContext): ReportDocument;
	buildFilename(context: TContext): string;
}
