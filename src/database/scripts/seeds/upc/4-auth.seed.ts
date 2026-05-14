import * as bcrypt from 'bcryptjs';
import { runTenantSeed } from '../seed-runner';

runTenantSeed('organization users and staff', async (tenantDataSource) => {
	const adminPassword = await bcrypt.hash('admin123', 10);
	const professorPassword = await bcrypt.hash('profesor123', 10);
	const studentPassword = await bcrypt.hash('estudiante123', 10);

	await tenantDataSource.query(
		`
		INSERT INTO "organization"."users" (
			document_type_id,
			document_code,
			first_name,
			last_name,
			email,
			phone,
			password,
			is_admin
		)
		SELECT
			v.document_type_id,
			v.document_code,
			v.first_name,
			v.last_name,
			v.email,
			v.phone,
			v.password,
			v.is_admin
		FROM (
			VALUES
				('101001', 70000001, 'Administrador', 'General', 'admin@upc.edu.pe', '+51990000001', $1, true),
				('101002', 70000002, 'Claudia', 'Calidad', 'calidad@upc.edu.pe', '+51990000002', $2, true),
				('101003', 70000003, 'Juan', 'Perez Rodriguez', 'prof.juan.perez@upc.edu.pe', '+51990000003', $3, false),
				('101004', 70000004, 'Maria', 'Garcia Torres', 'prof.maria.garcia@upc.edu.pe', '+51990000004', $4, false),
				('101005', 70000005, 'Luis', 'Ramirez Vega', 'student.luis.ramirez@upc.edu.pe', '+51990000005', $5, false),
				('101006', 70000006, 'Sofia', 'Torres Rojas', 'student.sofia.torres@upc.edu.pe', '+51990000006', $6, false)
		) AS v(document_type_id, document_code, first_name, last_name, email, phone, password, is_admin)
		WHERE NOT EXISTS (
			SELECT 1 FROM "organization"."users" u WHERE u.email = v.email
		);
		`,
		[adminPassword, adminPassword, professorPassword, professorPassword, studentPassword, studentPassword],
	);

	await tenantDataSource.query(`
		INSERT INTO "organization"."staff" (
			user_id,
			position_type_id,
			job_title,
			job_description,
			staff_email,
			staff_phone
		)
		SELECT
			u.id,
			t.id,
			v.job_title,
			v.job_description,
			u.email,
			u.phone
		FROM "organization"."users" u
		JOIN (
			VALUES
				('admin@upc.edu.pe', 'TG901-T001', 'Administrador general', 'Administracion del sistema academico'),
				('calidad@upc.edu.pe', 'TG901-T002', 'Coordinadora de calidad', 'Seguimiento de indicadores de acreditacion'),
				('prof.juan.perez@upc.edu.pe', 'TG901-T003', 'Profesor tiempo completo', 'Docente del programa de Ingenieria de Software'),
				('prof.maria.garcia@upc.edu.pe', 'TG901-T003', 'Profesora tiempo completo', 'Docente del programa de Ingenieria de Software')
		) AS v(email, position_type_code, job_title, job_description)
			ON u.email = v.email
		JOIN "core"."types" t
			ON t.code = v.position_type_code
		WHERE NOT EXISTS (
			SELECT 1 FROM "organization"."staff" s WHERE s.user_id = u.id
		);
	`);
});
