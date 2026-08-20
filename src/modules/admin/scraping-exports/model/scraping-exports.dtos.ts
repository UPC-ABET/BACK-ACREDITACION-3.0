// Route-param validation for the generic status/download/regenerate endpoints. `:exportType`
// isn't a JSON body, so it can't carry class-validator decorators the normal way — this module has
// no existing convention for a validated route param (checked: no PipeTransform/ParseEnumPipe usage
// anywhere else in the codebase), so a small typed lookup + a thrown domain error is the minimal fit.
import { BadRequestError } from 'src/commons/domain-error';
import { scrapingExportsValidationStrings } from '../config/strings/scraping-exports.validation';
import { ScrapingExportType } from './scraping-exports.types';

// Wire values (kebab-case, matching this file's existing route-naming style) mapped to the
// internal camelCase ScrapingExportType.
export const EXPORT_TYPE_PARAM_VALUES = [
	'docentes',
	'secciones',
	'alumnos-matriculados',
	'alumnos-secciones',
	'grades-rc',
] as const;

export type ExportTypeParam = (typeof EXPORT_TYPE_PARAM_VALUES)[number];

const EXPORT_TYPE_PARAM_MAP: Record<ExportTypeParam, ScrapingExportType> = {
	docentes: 'docentes',
	secciones: 'secciones',
	'alumnos-matriculados': 'alumnosMatriculados',
	'alumnos-secciones': 'alumnosSecciones',
	'grades-rc': 'gradesRc',
};

export function parseExportTypeParam(value: string): ScrapingExportType {
	const exportType = EXPORT_TYPE_PARAM_MAP[value as ExportTypeParam];
	if (!exportType) {
		throw new BadRequestError(scrapingExportsValidationStrings.error.invalidExportType);
	}
	return exportType;
}
