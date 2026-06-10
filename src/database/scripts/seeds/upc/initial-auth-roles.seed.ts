import { runTenantSeed, i18n } from '../seed-runner';
import { hashPassword } from 'src/libs/secure.functions';

// Initial baseline auth: create all roles, the full module/permission type catalog,
// grant ADMIN every module x permission, assign ADMIN to every user, and reset every
// user's password to "ABET2020" (folds in the behaviour of the local reset-admin helper).
runTenantSeed('initial auth roles and permissions', async (tenantDataSource) => {
	// 1. Roles (all four).
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

	// 2. Permission (TG2000) and module (TG2001) type groups.
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

	// 3. Permission + module types (full catalog, including the LOADS module).
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

	// 4. ADMIN gets every module x permission.
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

	// 5. Assign ADMIN to every user.
	await tenantDataSource.query(`
		INSERT INTO "core"."user_roles" (user_id, role_id, is_active)
		SELECT u.id, r.id, true
		FROM "organization"."users" u
		CROSS JOIN "core"."roles" r
		WHERE r.code = 'ADMIN'
		ON CONFLICT (user_id, role_id) DO UPDATE
		SET is_active = true, updated_at = now();
	`);

	// 6. Reset every user's password to "ABET2020".
	const password = await hashPassword('ABET2020');
	await tenantDataSource.query(
		`UPDATE "organization"."users" SET password = $1, updated_at = now()`,
		[password],
	);
});
