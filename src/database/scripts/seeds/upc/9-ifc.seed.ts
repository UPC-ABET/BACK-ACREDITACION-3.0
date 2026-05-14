import { runTenantSeed } from '../seed-runner';

runTenantSeed('ifc status module', async (tenantDataSource) => {
	await tenantDataSource.query(`
		INSERT INTO "ifc"."statuses" (
			ifc_id,
			status_type_id,
			staff_id,
			commentary,
			register_at
		)
		SELECT ifc.id, status_type.id, staff.id, v.commentary, v.register_at::timestamptz
		FROM (
			VALUES
				('IFC para medir pensamiento critico y solucion tecnica en Fundamentos de Programacion.', 'TG701-T002', 'calidad@upc.edu.pe', 'Indicador medido y analizado para el periodo 2026-1.', '2026-06-15 09:00:00'),
				('IFC para medir colaboracion y solucion tecnica en Proyecto Integrador.', 'TG701-T001', 'calidad@upc.edu.pe', 'Indicador planificado para medicion al cierre del proyecto integrador.', '2026-06-16 09:00:00')
		) AS v(ifc_information, status_type_code, staff_email, commentary, register_at)
		JOIN "evidence"."ifcs" ifc
			ON ifc.information = v.ifc_information
		JOIN "core"."types" status_type
			ON status_type.code = v.status_type_code
		JOIN "organization"."staff" staff
			ON staff.staff_email = v.staff_email
		WHERE NOT EXISTS (
			SELECT 1
			FROM "ifc"."statuses" status
			WHERE status.ifc_id = ifc.id
				AND status.status_type_id = status_type.id
				AND status.staff_id = staff.id
		);
	`);
});
