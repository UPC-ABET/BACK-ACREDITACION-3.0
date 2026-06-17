import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Survey notification messages are general templates per survey type; the program
 * is no longer required. Make program_id nullable so a message can apply to the
 * whole survey type instead of a single program.
 */
export class NotificationMessagesNullableProgram1781725913455 implements MigrationInterface {
	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "survey"."notification_messages" ALTER COLUMN "program_id" DROP NOT NULL`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "survey"."notification_messages" ALTER COLUMN "program_id" SET NOT NULL`,
		);
	}
}
