import { runTenantSeed, i18n } from '../seed-runner';
import { hashPassword } from 'src/libs/secure.functions';

runTenantSeed('organization users and staff', async (tenantDataSource) => {
	const mockPassword = await hashPassword('Password123!');

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
			dt.id,
			v.document_code,
			v.first_name,
			v.last_name,
			v.email,
			v.phone,
			v.password,
			v.is_admin
		FROM (
			VALUES
				('TG101-T001', 70000001, 'Administrador', 'General', 'admin@upc.edu.pe', '+51990000001', $1, true),
				('TG101-T001', 70000002, 'Claudia', 'Calidad', 'calidad@upc.edu.pe', '+51990000002', $2, true),
				('TG101-T001', 70000003, 'Juan', 'Perez Rodriguez', 'prof.juan.perez@upc.edu.pe', '+51990000003', $3, false),
				('TG101-T001', 70000004, 'Maria', 'Garcia Torres', 'prof.maria.garcia@upc.edu.pe', '+51990000004', $4, false),
				('TG101-T001', 70000005, 'Luis', 'Ramirez Vega', 'student.luis.ramirez@upc.edu.pe', '+51990000005', $5, false),
				('TG101-T001', 70000006, 'Sofia', 'Torres Rojas', 'student.sofia.torres@upc.edu.pe', '+51990000006', $6, false),
				('TG101-T001', 80000001, 'Ana', 'Admin', 'admin.eiscb@upc.edu.pe', '+51999900001', $7, true),
				('TG101-T001', 80000002, 'Diego', 'Director', 'director.eiscb@upc.edu.pe', '+51999900002', $7, false),
				('TG101-T001', 80000003, 'Camila', 'Coord', 'coord.eiscb@upc.edu.pe', '+51999900003', $7, false),
				('TG101-T001', 80000004, 'Carla', 'Decano', 'dean.eiscb@upc.edu.pe', '+51999900004', $7, false),
				('TG101-T001', 80000005, 'Sara', 'Programa', 'prog-coord.eiscb@upc.edu.pe', '+51999900005', $7, false),
				('TG101-T001', 80000006, 'Bruno', 'Area', 'area-coord.eiscb@upc.edu.pe', '+51999900006', $7, false),
				('TG101-T001', 80000007, 'Pablo', 'Subarea', 'subarea-coord.eiscb@upc.edu.pe', '+51999900007', $7, false),
				('TG101-T001', 70000007, 'Carlos', 'Mendez Ruiz', 'prof.carlos.mendez@upc.edu.pe', '+51990000007', $7, false),
				('TG101-T001', 70000008, 'Ana', 'Torres Quispe', 'prof.ana.torres@upc.edu.pe', '+51990000008', $7, false),
				('TG101-T001', 70000009, 'Jorge', 'Vargas Lima', 'prof.jorge.vargas@upc.edu.pe', '+51990000009', $7, false),
				('TG101-T001', 70000010, 'Lucia', 'Flores Castro', 'prof.lucia.flores@upc.edu.pe', '+51990000010', $7, false),
				('TG101-T001', 70000011, 'Pedro', 'Silva Vega', 'student.pedro.silva@upc.edu.pe', '+51990000011', $7, false),
				('TG101-T001', 70000012, 'Andrea', 'Quispe Rojas', 'student.andrea.quispe@upc.edu.pe', '+51990000012', $7, false),
				('TG101-T001', 70000013, 'Marco', 'Luna Torres', 'student.marco.luna@upc.edu.pe', '+51990000013', $7, false),
				('TG101-T001', 70000014, 'Diana', 'Paredes Huanca', 'student.diana.paredes@upc.edu.pe', '+51990000014', $7, false),
				('TG101-T001', 70000015, 'Roberto', 'Chavez Diaz', 'student.roberto.chavez@upc.edu.pe', '+51990000015', $7, false),
				('TG101-T001', 70000016, 'Valeria', 'Morales Soto', 'student.valeria.morales@upc.edu.pe', '+51990000016', $7, false),
				('TG101-T001', 70000017, 'Elena', 'Ramos Vega', 'student.elena.ramos@upc.edu.pe', '+51990000017', $7, false),
				('TG101-T001', 70000018, 'Alex', 'Medina Cruz', 'student.alex.medina@upc.edu.pe', '+51990000018', $7, false)
		) AS v(document_type_code, document_code, first_name, last_name, email, phone, password, is_admin)
		JOIN "core"."types" dt
			ON dt.code = v.document_type_code
		WHERE NOT EXISTS (
			SELECT 1 FROM "organization"."users" u WHERE u.email = v.email
		);
		`,
		[
			mockPassword,
			mockPassword,
			mockPassword,
			mockPassword,
			mockPassword,
			mockPassword,
			mockPassword,
		],
	);

	const staffValues = [
		[
			'admin@upc.edu.pe',
			'TG901-T001',
			i18n('Administrador general', 'General administrator'),
			i18n('Administracion del sistema academico', 'Administration of the academic system'),
		],
		[
			'calidad@upc.edu.pe',
			'TG901-T002',
			i18n('Coordinadora de calidad', 'Quality coordinator'),
			i18n('Seguimiento de indicadores de acreditacion', 'Tracking of accreditation indicators'),
		],
		[
			'prof.juan.perez@upc.edu.pe',
			'TG901-T003',
			i18n('Profesor tiempo completo', 'Full-time professor'),
			i18n(
				'Docente del programa de Ingenieria de Software',
				'Professor of the Software Engineering program',
			),
		],
		[
			'prof.maria.garcia@upc.edu.pe',
			'TG901-T003',
			i18n('Profesora tiempo completo', 'Full-time professor'),
			i18n(
				'Docente del programa de Ingenieria de Software',
				'Professor of the Software Engineering program',
			),
		],
		[
			'admin.eiscb@upc.edu.pe',
			'TG901-T001',
			i18n('Administrador EISCB', 'EISCB Administrator'),
			i18n('Administracion de la escuela EISCB', 'EISCB school administration'),
		],
		[
			'director.eiscb@upc.edu.pe',
			'TG901-T002',
			i18n('Director de Escuela EISCB', 'EISCB School Director'),
			i18n('Direccion academica de la escuela EISCB', 'Academic leadership of EISCB'),
		],
		[
			'coord.eiscb@upc.edu.pe',
			'TG901-T003',
			i18n('Coordinador de Curso EISCB', 'EISCB Course Coordinator'),
			i18n('Coordinacion de cursos de la escuela EISCB', 'Course coordination at EISCB'),
		],
		[
			'dean.eiscb@upc.edu.pe',
			'TG901-T001',
			i18n('Decano EISCB', 'EISCB Dean'),
			i18n('Decanato de la facultad', 'Faculty dean'),
		],
		[
			'prog-coord.eiscb@upc.edu.pe',
			'TG901-T002',
			i18n('Coordinadora de Carrera EISCB', 'EISCB Program Coordinator'),
			i18n('Coordinacion de la carrera CS', 'CS program coordination'),
		],
		[
			'area-coord.eiscb@upc.edu.pe',
			'TG901-T002',
			i18n('Coordinador de Area EISCB', 'EISCB Area Coordinator'),
			i18n('Coordinacion del area academica', 'Academic area coordination'),
		],
		[
			'subarea-coord.eiscb@upc.edu.pe',
			'TG901-T002',
			i18n('Coordinador de Subarea EISCB', 'EISCB Subarea Coordinator'),
			i18n('Coordinacion de subarea academica', 'Academic subarea coordination'),
		],
		[
			'prof.carlos.mendez@upc.edu.pe',
			'TG901-T003',
			i18n('Profesor tiempo completo', 'Full-time professor'),
			i18n(
				'Docente del programa de Ingenieria de Software',
				'Professor of the Software Engineering program',
			),
		],
		[
			'prof.ana.torres@upc.edu.pe',
			'TG901-T003',
			i18n('Profesora tiempo completo', 'Full-time professor'),
			i18n(
				'Docente del programa de Administracion de Empresas',
				'Professor of the Business Administration program',
			),
		],
		[
			'prof.jorge.vargas@upc.edu.pe',
			'TG901-T003',
			i18n('Profesor tiempo completo', 'Full-time professor'),
			i18n(
				'Docente del programa de Ciencias de la Computacion',
				'Professor of the Computer Science program',
			),
		],
		[
			'prof.lucia.flores@upc.edu.pe',
			'TG901-T003',
			i18n('Profesora tiempo completo', 'Full-time professor'),
			i18n(
				'Docente del programa de Ciencias de la Computacion',
				'Professor of the Computer Science program',
			),
		],
	]
		.map(
			([email, code, title, description]) =>
				`('${email}', '${code}', '${title}'::jsonb, '${description}'::jsonb)`,
		)
		.join(',\n\t\t\t');

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
				${staffValues}
		) AS v(email, position_type_code, job_title, job_description)
			ON u.email = v.email
		JOIN "core"."types" t
			ON t.code = v.position_type_code
		WHERE NOT EXISTS (
			SELECT 1 FROM "organization"."staff" s WHERE s.user_id = u.id
		);
	`);
});
