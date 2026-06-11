import { DataSource } from 'typeorm';
import { runTenantSeed, i18n } from '../seed-runner';
import { loadTypes } from './1-load-types';
import { loadCoreParameters } from './2-core.seed';
import { loadOrganization } from './3-organization.seed';

/*
 * initial — single, self-contained PROD baseline seed.
 *
 * Seeds only the structural data needed to stand up a production tenant:
 *   - core type-group + type catalog (1-load-types)
 *   - core institutional parameters (2-core)
 *   - organization: campuses, faculties, schools (3-organization)
 *   - academic: the production program (carrera) catalog
 *   - accreditation: the production accreditor and commission catalog
 *   - auth: the four roles, the full permission/module type catalog, and the ADMIN
 *           role granted every module x permission
 *
 * Intentionally excluded (demo/fixture data, not PROD): demo users & staff, academic
 * periods, program<->commission links, granting ADMIN to every user, and resetting
 * passwords. Operational data arrives later via the bulk upload process.
 *
 * Run:  npm run seed:initial <schema>
 */
async function loadAuthRolesAndPermissions(tenantDataSource: DataSource) {
	await tenantDataSource.query(`
		INSERT INTO "core"."roles" (id, name, code, description, is_active, created_at, updated_at)
		VALUES
			(1, '${i18n('Administrador', 'Admin')}'::jsonb, 'ADMIN', '${i18n('Acceso completo', 'Full access')}'::jsonb, true, '2026-05-23 00:11:25.260914+00', NULL),
			(2, '${i18n('Coordinador', 'Coordinator')}'::jsonb, 'COORDINATOR', '${i18n('Acceso de coordinador', 'Coordinator access')}'::jsonb, true, '2026-05-23 00:11:25.260914+00', NULL),
			(3, '${i18n('Usuario', 'User')}'::jsonb, 'USER', '${i18n('Usuario regular', 'Regular user')}'::jsonb, true, '2026-05-23 00:11:25.260914+00', NULL),
			(4, '${i18n('Docente', 'Professor')}'::jsonb, 'PROFESSOR', '${i18n('Acceso de docente', 'Professor access')}'::jsonb, true, '2026-05-23 00:11:25.260914+00', NULL)
		ON CONFLICT (code) DO UPDATE
		SET
			name = EXCLUDED.name,
			description = EXCLUDED.description,
			is_active = EXCLUDED.is_active,
			updated_at = now();
	`);

	await tenantDataSource.query(
		`SELECT setval(pg_get_serial_sequence('"core"."roles"', 'id'), GREATEST((SELECT MAX(id) FROM "core"."roles"), 1), true)`,
	);

	await tenantDataSource.query(`
		INSERT INTO "core"."type_groups" (extra, is_active, created_at, updated_at, code, name, description)
		VALUES
			('{}'::jsonb, true, '2026-05-22 15:59:19.782972+00', NULL, 'TG2000', '{"en":"Permission type","es":"Tipo de permisos"}'::jsonb, NULL),
			('{}'::jsonb, true, '2026-05-22 15:59:19.782972+00', NULL, 'TG2001', '{"en":"URL Module type","es":"Tipo de url modulo"}'::jsonb, NULL)
		ON CONFLICT (code) DO UPDATE
		SET
			extra = EXCLUDED.extra,
			is_active = EXCLUDED.is_active,
			name = EXCLUDED.name,
			description = EXCLUDED.description,
			updated_at = now();
	`);

	await tenantDataSource.query(`
		INSERT INTO "core"."types" (extra, is_active, created_at, updated_at, type_group_id, code, name, description)
		SELECT v.extra, v.is_active, v.created_at::timestamptz, NULL, tg.id, v.code, v.name, NULL
		FROM (
			VALUES
				('TG2000', '{}'::jsonb, true, '2026-05-22 15:59:19.950014+00', 'TG2000-T001', '{"en":"GET","es":"GET"}'::jsonb),
				('TG2000', '{}'::jsonb, true, '2026-05-22 15:59:19.950014+00', 'TG2000-T002', '{"en":"POST","es":"POST"}'::jsonb),
				('TG2000', '{}'::jsonb, true, '2026-05-22 15:59:19.950014+00', 'TG2000-T003', '{"en":"DELETE","es":"DELETE"}'::jsonb),
				('TG2000', '{}'::jsonb, true, '2026-05-22 15:59:19.950014+00', 'TG2000-T004', '{"en":"PUT","es":"PUT"}'::jsonb),
				('TG2000', '{}'::jsonb, true, '2026-05-22 15:59:19.950014+00', 'TG2000-T005', '{"en":"PATCH","es":"PATCH"}'::jsonb),
				('TG2001', '{"route":"/","module":"HOME"}'::jsonb, true, '2026-05-22 20:55:33.573608+00', 'TG2001-T001', '{"en":"Home","es":"Inicio"}'::jsonb),
				('TG2001', '{"route":"/ifcs","module":"IFCS"}'::jsonb, true, '2026-05-22 20:55:33.573608+00', 'TG2001-T002', '{"en":"IFCs","es":"IFCs"}'::jsonb),
				('TG2001', '{"route":"/ifc-findings","module":"IFC_FINDINGS"}'::jsonb, true, '2026-05-22 20:55:33.573608+00', 'TG2001-T003', '{"en":"IFC Findings","es":"Hallazgos IFC"}'::jsonb),
				('TG2001', '{"route":"/admin","module":"ADMIN"}'::jsonb, true, '2026-05-22 20:55:33.573608+00', 'TG2001-T004', '{"en":"Admin","es":"Administracion"}'::jsonb),
				('TG2001', '{"route":"/tests","module":"TESTS"}'::jsonb, true, '2026-05-22 20:55:33.573608+00', 'TG2001-T005', '{"en":"Tests","es":"Pruebas"}'::jsonb),
				('TG2001', '{"route":"/users","module":"USERS"}'::jsonb, true, '2026-05-22 20:55:33.573608+00', 'TG2001-T006', '{"en":"Users","es":"Usuarios"}'::jsonb),
				('TG2001', '{"route":"/academic","module":"ACADEMIC"}'::jsonb, true, '2026-05-22 20:55:33.573608+00', 'TG2001-T007', '{"en":"Academic","es":"Academico"}'::jsonb),
				('TG2001', '{"route":"/accreditation","module":"ACCREDITATION"}'::jsonb, true, '2026-05-22 20:55:33.573608+00', 'TG2001-T008', '{"en":"Accreditation","es":"Acreditacion"}'::jsonb),
				('TG2001', '{"route":"/evaluation","module":"EVALUATION"}'::jsonb, true, '2026-05-22 20:55:33.573608+00', 'TG2001-T009', '{"en":"Evaluation","es":"Evaluacion"}'::jsonb),
				('TG2001', '{"route":"/evidence","module":"EVIDENCE"}'::jsonb, true, '2026-05-22 20:55:33.573608+00', 'TG2001-T010', '{"en":"Evidence","es":"Evidencia"}'::jsonb),
				('TG2001', '{"route":"/improvement","module":"IMPROVEMENT"}'::jsonb, true, '2026-05-22 20:55:33.573608+00', 'TG2001-T011', '{"en":"Improvement","es":"Mejora Continua"}'::jsonb),
				('TG2001', '{"route":"/organization","module":"ORGANIZATION"}'::jsonb, true, '2026-05-22 20:55:33.573608+00', 'TG2001-T012', '{"en":"Organization","es":"Organizacion"}'::jsonb),
				('TG2001', '{"route":"/survey","module":"SURVEY"}'::jsonb, true, '2026-05-22 20:55:33.573608+00', 'TG2001-T013', '{"en":"Survey","es":"Encuestas"}'::jsonb),
				('TG2001', '{"route":"/core","module":"CORE"}'::jsonb, true, '2026-05-22 20:55:33.573608+00', 'TG2001-T014', '{"en":"Core","es":"Nucleo"}'::jsonb),
				('TG2001', '{"route":"/rubrics","module":"RUBRICS"}'::jsonb, true, '2026-05-22 20:55:33.573608+00', 'TG2001-T015', '{"en":"Rubrics","es":"Rubricas"}'::jsonb),
				('TG2001', '{"route":"/loads","module":"LOADS"}'::jsonb, true, '2026-05-22 20:55:33.573608+00', 'TG2001-T016', '{"en":"Loads","es":"Cargas"}'::jsonb)
		) AS v(type_group_code, extra, is_active, created_at, code, name)
		JOIN "core"."type_groups" tg ON tg.code = v.type_group_code
		ON CONFLICT (code) DO UPDATE
		SET
			extra = EXCLUDED.extra,
			is_active = EXCLUDED.is_active,
			type_group_id = EXCLUDED.type_group_id,
			name = EXCLUDED.name,
			description = EXCLUDED.description,
			updated_at = now();
	`);

	await tenantDataSource.query(`
		INSERT INTO "core"."role_module_permissions" (role_id, module_type_id, permission_type_id, is_active)
		SELECT r.id, mt.id, pt.id, true
		FROM "core"."roles" r
		CROSS JOIN "core"."types" mt
		CROSS JOIN "core"."types" pt
		WHERE r.code = 'ADMIN'
		AND mt.code LIKE 'TG2001-%'
		AND pt.code LIKE 'TG2000-%'
		ON CONFLICT (role_id, module_type_id, permission_type_id) DO UPDATE
		SET is_active = true, updated_at = now();
	`);
}

async function loadPrograms(tenantDataSource: DataSource) {
	const REGULAR = 'TG102-T001';
	const EPE = 'TG102-T002';
	const bachelor = i18n('Bachiller', 'Bachelor');

	const programRows: Array<[string, string, string]> = [
		[REGULAR, 'IGE', i18n('Ingenieria Gestion Empresarial', 'Business Management Engineering')],
		[REGULAR, 'IGM', i18n('Ingenieria Gestion Minera', 'Mining Management Engineering')],
		[REGULAR, 'IA', i18n('Ingenieria Ambiental', 'Environmental Engineering')],
		[REGULAR, 'BIO', i18n('Ingenieria Biomedica', 'Biomedical Engineering')],
		[
			REGULAR,
			'SI',
			i18n('Ingenieria de Sistemas de Informacion', 'Information Systems Engineering'),
		],
		[EPE, 'IS', i18n('Ingenieria de Sistemas', 'Systems Engineering')],
		[REGULAR, 'CB', i18n('Ingenieria de Ciberseguridad', 'Cybersecurity Engineering')],
		[REGULAR, 'CC', i18n('Ciencias de la Computacion', 'Computer Science')],
		[REGULAR, 'SW', i18n('Ingenieria de Software', 'Software Engineering')],
		[
			REGULAR,
			'IIA',
			i18n('Ingenieria Inteligencia Artificial', 'Artificial Intelligence Engineering'),
		],
		[REGULAR, 'ELE', i18n('Ingenieria Electronica', 'Electronics Engineering')],
		[REGULAR, 'MEC', i18n('Ingenieria Mecatronica', 'Mechatronics Engineering')],
		[EPE, 'RED', i18n('Redes', 'Networks')],
		[REGULAR, 'INDAC', i18n('Ingenieria Industrial', 'Industrial Engineering')],
		[EPE, 'INDFC', i18n('Ingenieria Industrial', 'Industrial Engineering')],
		[REGULAR, 'CIVAC', i18n('Ingenieria Civil', 'Civil Engineering')],
		[EPE, 'CIVFC', i18n('Ingenieria Civil', 'Civil Engineering')],
	];

	const programValues = programRows
		.map(
			([modality, code, name]) =>
				`('${modality}', '${code}', '${name}'::jsonb, '${bachelor}'::jsonb)`,
		)
		.join(',\n\t\t\t');

	await tenantDataSource.query(`
		INSERT INTO "academic"."programs" (modality_type_id, code, name, degree)
		SELECT t.id, v.code, v.name, v.degree
		FROM "core"."types" t
		JOIN (
			VALUES
				${programValues}
		) AS v(modality_type_code, code, name, degree)
			ON t.code = v.modality_type_code
		WHERE NOT EXISTS (
			SELECT 1 FROM "academic"."programs" p WHERE p.code = v.code
		);
	`);
}

async function loadAccreditation(tenantDataSource: DataSource) {
	const accreditorRows: Array<[string, string]> = [
		[
			'ABET',
			i18n(
				'Junta de Acreditacion para Ingenieria y Tecnologia',
				'Accreditation Board for Engineering and Technology',
			),
		],
		[
			'WASC',
			i18n(
				'Asociacion Occidental de Escuelas y Universidades',
				'Western Association of Schools and Colleges',
			),
		],
	];

	const accreditorValues = accreditorRows
		.map(([code, name]) => `('${code}', '${name}'::jsonb)`)
		.join(',\n\t\t\t');

	await tenantDataSource.query(`
		INSERT INTO "accreditation"."accreditors" (code, name)
		SELECT v.code, v.name
		FROM (
			VALUES
				${accreditorValues}
		) AS v(code, name)
		WHERE NOT EXISTS (
			SELECT 1 FROM "accreditation"."accreditors" a WHERE a.code = v.code
		);
	`);

	const commissionRows: Array<[string, string, string]> = [
		['ABET', 'EAC', i18n('EAC', 'EAC')],
		['ABET', 'CAC', i18n('CAC', 'CAC')],
		['ABET', 'ICT', i18n('ICT', 'ICT')],
		['WASC', 'WASC', i18n('WASC', 'WASC')],
	];

	const commissionValues = commissionRows
		.map(([accreditorCode, code, name]) => `('${accreditorCode}', '${code}', '${name}'::jsonb)`)
		.join(',\n\t\t\t');

	await tenantDataSource.query(`
		INSERT INTO "accreditation"."commissions" (accreditor_id, code, name)
		SELECT accreditor.id, v.code, v.name
		FROM "accreditation"."accreditors" accreditor
		JOIN (
			VALUES
				${commissionValues}
		) AS v(accreditor_code, code, name)
			ON accreditor.code = v.accreditor_code
		WHERE NOT EXISTS (
			SELECT 1 FROM "accreditation"."commissions" c WHERE c.code = v.code
		);
	`);
}

runTenantSeed('initial PROD baseline', async (tenantDataSource) => {
	await loadTypes(tenantDataSource);
	await loadCoreParameters(tenantDataSource);
	await loadOrganization(tenantDataSource);
	await loadPrograms(tenantDataSource);
	await loadAccreditation(tenantDataSource);
	await loadAuthRolesAndPermissions(tenantDataSource);
});
