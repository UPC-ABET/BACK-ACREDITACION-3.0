import type { I18nText } from 'src/shared/types/i18n';
import { pppValidationStrings } from './ppp.validation';

/** One reason a bulk-upload row was rejected: an i18n key plus whatever the message
 *  interpolates. The API returns these as-is, so the client renders them like any
 *  other error rather than receiving text the backend chose a language for. */
export type PppUploadRowError = {
	key: string;
	args?: Record<string, string | number>;
};

/** A row error paired with the worksheet row it belongs to. `row: 0` means the job
 *  itself failed rather than any particular row, since row 1 is the header and no
 *  data row can ever carry it. */
export type PppUploadRowErrorItem = PppUploadRowError & { row: number };

const { upload } = pppValidationStrings.error;

/**
 * Display text for the "Errores" column of the annotated workbook the user
 * downloads. This map exists only because the *backend* writes that spreadsheet,
 * so it is the one place that has to turn a key into words; everything the API
 * returns stays a key. Values are bilingual `I18nText`, exactly like every other
 * display string in the system.
 */
const UPLOAD_ROW_ERROR_TEXT: Record<string, I18nText> = {
	[upload.studentCodeRequired]: {
		es: 'El código de alumno es obligatorio',
		en: 'The student code is required',
	},
	[upload.invalidPracticeNumber]: {
		es: 'Número de práctica inválido (debe ser 1 o 2)',
		en: 'Invalid practice number (must be 1 or 2)',
	},
	[upload.studentNotFound]: {
		es: 'No se encontró al alumno con código "{code}"',
		en: 'No student found with code "{code}"',
	},
	[upload.noCourseSection]: {
		es: 'No hay una sección de curso disponible para registrar la práctica',
		en: 'No course section is available to register the internship',
	},
	[upload.invalidScore]: {
		es: 'Nota inválida en la columna {label}: "{value}" (debe ser un número entre 1 y 5)',
		en: 'Invalid score in column {label}: "{value}" (must be a number between 1 and 5)',
	},
	[upload.noScores]: {
		es: 'La fila no tiene ninguna nota de competencia',
		en: 'The row carries no competence score at all',
	},
	[upload.duplicateSurvey]: {
		es: 'El alumno {code} ya tiene registrada la práctica {practiceNumber} en este periodo',
		en: 'Student {code} already has practice {practiceNumber} registered for this period',
	},
	[upload.duplicateInFile]: {
		es: 'El archivo repite la práctica {practiceNumber} del alumno {code} (ya está en la fila {firstRow})',
		en: 'The file repeats practice {practiceNumber} for student {code} (already on row {firstRow})',
	},
	[upload.saveFailed]: {
		es: 'No se guardó ninguna fila: la operación falló ({reason})',
		en: 'No row was saved: the operation failed ({reason})',
	},
};

const DEFAULT_UPLOAD_LANG = 'es';

/** Renders one row error for the annotated workbook. Unknown keys fall back to the
 *  key itself, which is ugly in a spreadsheet but never silently blank. */
export function renderPppUploadRowError(
	error: PppUploadRowError,
	lang: string = DEFAULT_UPLOAD_LANG,
): string {
	const text = UPLOAD_ROW_ERROR_TEXT[error.key];
	if (!text) return error.key;

	const template = text[lang] ?? text[DEFAULT_UPLOAD_LANG] ?? error.key;
	return Object.entries(error.args ?? {}).reduce(
		(rendered, [name, value]) => rendered.split(`{${name}}`).join(String(value)),
		template,
	);
}
