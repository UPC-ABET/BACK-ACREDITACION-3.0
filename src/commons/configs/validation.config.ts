export class ValidationConfig {
	/* =========================
	 * IDs
	 * ========================= */
	static readonly REQUIRED_ID_MESSAGE = 'El ID es obligatorio';
	static readonly NOT_FOUND_MESSAGE = 'El registro no existe';
	static readonly NOT_FOUND_ENTITY = (entity: string) => `No se encontró ${entity}`;

	/* =========================
	 * NUMÉRICOS
	 * ========================= */
	static readonly POSITIVE_NUMBER_MESSAGE = 'El valor debe ser un número positivo';

	/* =========================
	 * STRINGS
	 * ========================= */
	static readonly REQUIRED_STRING_MESSAGE = 'El campo es obligatorio';
	static readonly INVALID_STRING_MESSAGE = 'Formato inválido';

	/* =========================
	 * ESTADOS
	 * ========================= */
	static readonly INVALID_STATUS_MESSAGE = 'Estado inválido';

	/* =========================
	 * FK / RELACIONES
	 * ========================= */
	static readonly FK_REQUIRED = (entity: string) => `El ID de ${entity} es obligatorio`;

	static readonly FK_NOT_FOUND = (entity: string) => `No existe el registro relacionado en ${entity}`;

	/* =========================
	 * TRANSACCIONAL
	 * ========================= */
	static readonly CREATE_FAILED = 'No se pudo registrar el recurso';
	static readonly UPDATE_FAILED = 'No se pudo actualizar el recurso';
	static readonly DELETE_FAILED = 'No se pudo eliminar el recurso';
}
