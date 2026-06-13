import { MigrationInterface, QueryRunner } from 'typeorm';

/*
 * core.notification_logs.status was a free-form character varying(100) (only ever written as
 * 'sent'). Replace it with a status_type_id FK to core.types so the status is a first-class
 * catalog value, consistent with every other status field.
 *
 * The notification-log outcome is its OWN type group (TG1005 NOTIFICATION_LOG_STATUS: Sent /
 * Failed), kept separate from the survey notification lifecycle (TG1001: Scheduled -> Sent).
 * They are different concepts: a notification_logs row only exists once an email was dispatched,
 * so it is never "Scheduled".
 *
 * A core.notification_logs row is written ONLY when an email is actually sent (skips/failures
 * currently write no row), so status_type_id is never absent on an existing row → NOT NULL.
 *
 * notification_logs is empty in production (added in 1778977562000 with no backfill), so dropping
 * the column and adding a NOT NULL FK is safe without a data migration. The TG1005 type group +
 * types are seeded here (idempotently) so the live DB has them without re-running the seeds.
 */
export class NotificationLogStatusType1780187162000 implements MigrationInterface {
	name = 'NotificationLogStatusType1780187162000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		// Notification-log status type group (distinct from the survey lifecycle TG1001).
		await queryRunner.query(`
			INSERT INTO core.type_groups (code, name, description, extra, is_active, created_at, updated_at)
			VALUES (
				'TG1005',
				'{"es":"Estado de bitacora de notificacion","en":"Notification log status"}'::jsonb,
				'{"es":"Resultado del envio registrado en la bitacora de notificaciones","en":"Send outcome recorded in the notification log"}'::jsonb,
				'{}'::jsonb, true, NOW(), NOW())
			ON CONFLICT (code) DO NOTHING
		`);
		await queryRunner.query(`
			INSERT INTO core.types (type_group_id, code, name, description, extra, is_active, created_at, updated_at)
			SELECT g.id, v.code, v.name::jsonb, v.description::jsonb, '{}'::jsonb, true, NOW(), NOW()
			FROM core.type_groups g
			JOIN (VALUES
				('TG1005-T001', '{"es":"Enviada","en":"Sent"}', '{"es":"Correo enviado correctamente","en":"Email sent successfully"}'),
				('TG1005-T002', '{"es":"Fallida","en":"Failed"}', '{"es":"El envio del correo fallo","en":"Email send failed"}')
			) AS v(code, name, description) ON TRUE
			WHERE g.code = 'TG1005'
			ON CONFLICT (code) DO NOTHING
		`);

		await queryRunner.query(`ALTER TABLE "core"."notification_logs" DROP COLUMN "status"`);
		await queryRunner.query(
			`ALTER TABLE "core"."notification_logs" ADD "status_type_id" integer NOT NULL`,
		);
		await queryRunner.query(
			`ALTER TABLE "core"."notification_logs" ADD CONSTRAINT "FK_notification_logs_status_type_id" FOREIGN KEY ("status_type_id") REFERENCES "core"."types"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "core"."notification_logs" DROP CONSTRAINT "FK_notification_logs_status_type_id"`,
		);
		await queryRunner.query(`ALTER TABLE "core"."notification_logs" DROP COLUMN "status_type_id"`);
		await queryRunner.query(
			`ALTER TABLE "core"."notification_logs" ADD "status" character varying(100)`,
		);

		await queryRunner.query(`DELETE FROM core.types WHERE code IN ('TG1005-T001', 'TG1005-T002')`);
		await queryRunner.query(`DELETE FROM core.type_groups WHERE code = 'TG1005'`);
	}
}
