// Tipos y constantes PUROS del flujo de carga de Organigrama (sin deps de Nest/class-validator).
// Espejo de OrganigramaFileModel (ABET 2.0). Réplica del contrato de USP_OrganigramaCargaMasiva.

// Una fila del Excel de Organigrama (UnidadAcademica + SedeUnidadAcademica + UnidadAcademicaResponsable).
// Columnas legacy: CodigoEntidad, Nombre, Nivel (1..6), TipoEntidad, ResponsableUserName, SedeCode, CodigoEntidadPadre.
export interface ChartRow {
	rowNumber: number;
	entityCode: string;         // code de la unidad académica (escuela/carrera/curso/...)
	name: string;               // nombre del nodo (level_title — jsonb i18n)
	level: string;              // 1..6 (string en Excel, se castea)
	entityTypeCode: string;     // code en core.types/ENTITY_TYPE (SCHOOL/PROGRAM/COURSE/...)
	responsibleUserName: string;// staff.code/staff_email del responsable
	campusCode: string;         // organization.campuses.code (opcional — solo aplica al nivel sede)
	parentEntityCode: string;   // entity_code del padre — vacío en GGE (nivel 1)
}

export interface RowValidationResult {
	rowNumber: number;
	errors: string[];
}

export interface UploadResult {
	success: boolean;
	message: string | null;
	uploadLogId: number | null;
	totalRows: number;
	loadedRows: number;
	errorRows: number;
	excelWithErrors: string | null;
	fileName: string | null;
}
