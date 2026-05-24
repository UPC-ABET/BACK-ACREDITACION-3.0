import { runTenantSeed } from '../seed-runner';

runTenantSeed('auth roles and permissions', async (tenantDataSource) => {
	await tenantDataSource.query(`
		INSERT INTO "core"."roles" (id, name, code, description, is_active, created_at, updated_at)
		VALUES
			(1, '{"en":"Admin","es":"Administrador"}'::jsonb, 'ADMIN', 'Acceso completo', true, '2026-05-23 00:11:25.260914+00', NULL),
			(2, '{"en":"Coordinator","es":"Coordinador"}'::jsonb, 'COORDINATOR', 'Acceso de coordinador', true, '2026-05-23 00:11:25.260914+00', NULL),
			(3, '{"en":"User","es":"Usuario"}'::jsonb, 'USER', 'Usuario regular', true, '2026-05-23 00:11:25.260914+00', NULL)
		ON CONFLICT (code) DO UPDATE
		SET
			name = EXCLUDED.name,
			description = EXCLUDED.description,
			is_active = EXCLUDED.is_active,
			updated_at = now();
	`);

	await tenantDataSource.query(`SELECT setval(pg_get_serial_sequence('"core"."roles"', 'id'), GREATEST((SELECT MAX(id) FROM "core"."roles"), 1), true)`);

	await tenantDataSource.query(`
		INSERT INTO "core"."type_groups" (id, extra, is_active, created_at, updated_at, code, name, description)
		VALUES
			(26, '{}'::jsonb, true, '2026-05-22 15:59:19.782972+00', NULL, 'TG2000', '{"en":"Permission type","es":"Tipo de permisos"}'::jsonb, NULL),
			(27, '{}'::jsonb, true, '2026-05-22 15:59:19.782972+00', NULL, 'TG2001', '{"en":"URL Module type","es":"Tipo de url modulo"}'::jsonb, NULL)
		ON CONFLICT (code) DO UPDATE
		SET
			extra = EXCLUDED.extra,
			is_active = EXCLUDED.is_active,
			name = EXCLUDED.name,
			description = EXCLUDED.description,
			updated_at = now();
	`);

	await tenantDataSource.query(`SELECT setval(pg_get_serial_sequence('"core"."type_groups"', 'id'), GREATEST((SELECT MAX(id) FROM "core"."type_groups"), 1), true)`);

	await tenantDataSource.query(`
		INSERT INTO "core"."types" (id, extra, is_active, created_at, updated_at, type_group_id, code, name, description)
		SELECT v.id, v.extra, v.is_active, v.created_at::timestamptz, NULL, tg.id, v.code, v.name, NULL
		FROM (
			VALUES
				(70, 'TG2000', '{}'::jsonb, true, '2026-05-22 15:59:19.950014+00', 'TG2000-T001', '{"en":"GET","es":"GET"}'::jsonb),
				(71, 'TG2000', '{}'::jsonb, true, '2026-05-22 15:59:19.950014+00', 'TG2000-T002', '{"en":"POST","es":"POST"}'::jsonb),
				(72, 'TG2000', '{}'::jsonb, true, '2026-05-22 15:59:19.950014+00', 'TG2000-T003', '{"en":"DELETE","es":"DELETE"}'::jsonb),
				(73, 'TG2000', '{}'::jsonb, true, '2026-05-22 15:59:19.950014+00', 'TG2000-T004', '{"en":"PUT","es":"PUT"}'::jsonb),
				(74, 'TG2000', '{}'::jsonb, true, '2026-05-22 15:59:19.950014+00', 'TG2000-T005', '{"en":"PATCH","es":"PATCH"}'::jsonb),
				(75, 'TG2001', '{"route":"/","module":"HOME"}'::jsonb, true, '2026-05-22 20:55:33.573608+00', 'TG2001-T001', '{"en":"Home","es":"Inicio"}'::jsonb),
				(76, 'TG2001', '{"route":"/ifcs","module":"IFCS"}'::jsonb, true, '2026-05-22 20:55:33.573608+00', 'TG2001-T002', '{"en":"IFCs","es":"IFCs"}'::jsonb),
				(77, 'TG2001', '{"route":"/ifc-findings","module":"IFC_FINDINGS"}'::jsonb, true, '2026-05-22 20:55:33.573608+00', 'TG2001-T003', '{"en":"IFC Findings","es":"Hallazgos IFC"}'::jsonb),
				(78, 'TG2001', '{"route":"/admin","module":"ADMIN"}'::jsonb, true, '2026-05-22 20:55:33.573608+00', 'TG2001-T004', '{"en":"Admin","es":"Administracion"}'::jsonb),
				(79, 'TG2001', '{"route":"/tests","module":"TESTS"}'::jsonb, true, '2026-05-22 20:55:33.573608+00', 'TG2001-T005', '{"en":"Tests","es":"Pruebas"}'::jsonb)
		) AS v(id, type_group_code, extra, is_active, created_at, code, name)
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

	await tenantDataSource.query(`SELECT setval(pg_get_serial_sequence('"core"."types"', 'id'), GREATEST((SELECT MAX(id) FROM "core"."types"), 1), true)`);

	await tenantDataSource.query(`
		INSERT INTO "core"."user_roles" (user_id, role_id, is_active)
		SELECT u.id, r.id, true
		FROM "organization"."users" u
		JOIN "core"."roles" r ON r.code = 'ADMIN'
		WHERE u.email = 'admin@upc.edu.pe'
		ON CONFLICT (user_id, role_id) DO UPDATE
		SET is_active = true, updated_at = now();
	`);

	await tenantDataSource.query(`
		INSERT INTO "core"."role_module_permissions" (role_id, module_type_id, permission_type_id, is_active)
		SELECT admin_role.id, module_type.id, permission_type.id, true
		FROM "core"."roles" admin_role
		JOIN "core"."types" module_type ON module_type.code = 'TG2001-T004'
		JOIN "core"."types" permission_type ON permission_type.code = 'TG2000-T001'
		WHERE admin_role.code = 'ADMIN'
		ON CONFLICT (role_id, module_type_id, permission_type_id) DO UPDATE
		SET is_active = true, updated_at = now();
	`);
});
