import { MigrationInterface, QueryRunner } from 'typeorm';

// Partial unique index enforcing 1 staff <-> 1 user (NULLs excluded). up() raises with the offending
// user_ids if any are already linked to multiple staff, rather than silently nulling links.
export class AddStaffUserUniqueLink1781563012764 implements MigrationInterface {
	name = 'AddStaffUserUniqueLink1781563012764';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
DO $$
DECLARE
	v_dupes text;
BEGIN
	SELECT string_agg(user_id::text, ', ' ORDER BY user_id) INTO v_dupes
	FROM (
		SELECT user_id
		FROM organization.staff
		WHERE user_id IS NOT NULL
		GROUP BY user_id
		HAVING count(*) > 1
	) d;

	IF v_dupes IS NOT NULL THEN
		RAISE EXCEPTION 'Cannot create UQ_staff_user_id: user_id(s) % are linked to multiple staff. Resolve the duplicate links before migrating.', v_dupes;
	END IF;
END $$;
`);

		await queryRunner.query(`
CREATE UNIQUE INDEX "UQ_staff_user_id"
	ON organization.staff (user_id)
	WHERE user_id IS NOT NULL;
`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX IF EXISTS organization."UQ_staff_user_id";`);
	}
}
