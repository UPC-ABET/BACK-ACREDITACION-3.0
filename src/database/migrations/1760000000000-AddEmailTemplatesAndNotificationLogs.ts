import { MigrationInterface, QueryRunner } from 'typeorm';

/*
 * Adds the generic email-template + notification-log infrastructure:
 *   - core.email_templates           (subject/body i18n, category via core.types TG1004)
 *   - core.notification_logs         (generic, replaces ifc.notification_logs)
 *   - ifc.notification_configs       -> drop title/body, add email_template_id FK
 *   - survey.notification_messages   -> drop title/body, add email_template_id FK
 *
 * No data backfill: notification_configs / notification_messages / notification_logs
 * are empty in production (only the initial seed has run), so dropping title/body and
 * adding NOT NULL FK columns is safe without defaults.
 */
export class AddEmailTemplatesAndNotificationLogs1760000000000 implements MigrationInterface {
	name = 'AddEmailTemplatesAndNotificationLogs1760000000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE TABLE "core"."email_templates" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "category_type_id" integer NOT NULL, "code" character varying(50) NOT NULL, "name" jsonb NOT NULL DEFAULT '{}'::jsonb, "subject" jsonb NOT NULL DEFAULT '{}'::jsonb, "body" jsonb NOT NULL DEFAULT '{}'::jsonb, CONSTRAINT "UQ_email_templates_code" UNIQUE ("code"), CONSTRAINT "PK_email_templates" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`ALTER TABLE "core"."email_templates" ADD CONSTRAINT "FK_email_templates_category_type_id" FOREIGN KEY ("category_type_id") REFERENCES "core"."types"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);

		await queryRunner.query(
			`CREATE TABLE "core"."notification_logs" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "category_type_id" integer NOT NULL, "email_template_id" integer, "notifier_user_id" integer, "to_emails" jsonb NOT NULL DEFAULT '[]', "cc_emails" jsonb NOT NULL DEFAULT '[]', "to_staff_ids" jsonb NOT NULL DEFAULT '[]', "cc_staff_ids" jsonb NOT NULL DEFAULT '[]', "provider_message_id" character varying(255), "status" character varying(100), "error_message" text, "context" jsonb NOT NULL DEFAULT '{}'::jsonb, CONSTRAINT "PK_core_notification_logs" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`ALTER TABLE "core"."notification_logs" ADD CONSTRAINT "FK_notification_logs_category_type_id" FOREIGN KEY ("category_type_id") REFERENCES "core"."types"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "core"."notification_logs" ADD CONSTRAINT "FK_notification_logs_email_template_id" FOREIGN KEY ("email_template_id") REFERENCES "core"."email_templates"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "core"."notification_logs" ADD CONSTRAINT "FK_notification_logs_notifier_user_id" FOREIGN KEY ("notifier_user_id") REFERENCES "organization"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);

		// Replace the IFC-specific log with the generic one.
		await queryRunner.query(`DROP TABLE "ifc"."notification_logs"`);

		// ifc.notification_configs: content moves to email_templates.
		await queryRunner.query(
			`ALTER TABLE "ifc"."notification_configs" ADD "email_template_id" integer NOT NULL`,
		);
		await queryRunner.query(`ALTER TABLE "ifc"."notification_configs" DROP COLUMN "title"`);
		await queryRunner.query(`ALTER TABLE "ifc"."notification_configs" DROP COLUMN "body"`);
		await queryRunner.query(
			`ALTER TABLE "ifc"."notification_configs" ADD CONSTRAINT "FK_notification_configs_email_template_id" FOREIGN KEY ("email_template_id") REFERENCES "core"."email_templates"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);

		// survey.notification_messages: content moves to email_templates.
		await queryRunner.query(
			`ALTER TABLE "survey"."notification_messages" ADD "email_template_id" integer NOT NULL`,
		);
		await queryRunner.query(`ALTER TABLE "survey"."notification_messages" DROP COLUMN "title"`);
		await queryRunner.query(`ALTER TABLE "survey"."notification_messages" DROP COLUMN "body"`);
		await queryRunner.query(
			`ALTER TABLE "survey"."notification_messages" ADD CONSTRAINT "FK_notification_messages_email_template_id" FOREIGN KEY ("email_template_id") REFERENCES "core"."email_templates"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// survey.notification_messages: restore title/body, drop FK.
		await queryRunner.query(
			`ALTER TABLE "survey"."notification_messages" DROP CONSTRAINT "FK_notification_messages_email_template_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "survey"."notification_messages" DROP COLUMN "email_template_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "survey"."notification_messages" ADD "title" jsonb NOT NULL DEFAULT '{}'::jsonb`,
		);
		await queryRunner.query(
			`ALTER TABLE "survey"."notification_messages" ADD "body" jsonb NOT NULL DEFAULT '{}'::jsonb`,
		);

		// ifc.notification_configs: restore title/body, drop FK.
		await queryRunner.query(
			`ALTER TABLE "ifc"."notification_configs" DROP CONSTRAINT "FK_notification_configs_email_template_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "ifc"."notification_configs" DROP COLUMN "email_template_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "ifc"."notification_configs" ADD "title" jsonb NOT NULL DEFAULT '{}'::jsonb`,
		);
		await queryRunner.query(
			`ALTER TABLE "ifc"."notification_configs" ADD "body" jsonb NOT NULL DEFAULT '{}'::jsonb`,
		);

		// Recreate the IFC-specific notification log.
		await queryRunner.query(
			`CREATE TABLE "ifc"."notification_logs" ("id" SERIAL NOT NULL, "extra" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE, "ifc_id" integer NULL, "chart_id" integer NOT NULL, "notification_config_id" integer NOT NULL, "notifier_user_id" integer NULL, "to_staff_ids" jsonb NOT NULL DEFAULT '[]', "cc_staff_ids" jsonb NOT NULL DEFAULT '[]', "provider_message_id" character varying(254) NULL, CONSTRAINT "PK_notification_logs" PRIMARY KEY ("id"))`,
		);

		await queryRunner.query(
			`ALTER TABLE "core"."notification_logs" DROP CONSTRAINT "FK_notification_logs_notifier_user_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "core"."notification_logs" DROP CONSTRAINT "FK_notification_logs_email_template_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "core"."notification_logs" DROP CONSTRAINT "FK_notification_logs_category_type_id"`,
		);
		await queryRunner.query(`DROP TABLE "core"."notification_logs"`);

		await queryRunner.query(
			`ALTER TABLE "core"."email_templates" DROP CONSTRAINT "FK_email_templates_category_type_id"`,
		);
		await queryRunner.query(`DROP TABLE "core"."email_templates"`);
	}
}
