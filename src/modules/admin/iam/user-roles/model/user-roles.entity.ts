import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { IntegerFKIDColumn } from 'src/commons/configs/db.configs';
import { UserEntity } from 'src/modules/organization/users/model/users.entity';
import { RoleEntity } from 'src/modules/admin/iam/roles/model/roles.entity';

@Entity({ name: 'user_roles', schema: 'core' })
export class UserRoleEntity extends BaseEntity {
	// %% ATTRIBUTES

	@IntegerFKIDColumn({ nullable: false })
	userId: number;

	@IntegerFKIDColumn({ nullable: false })
	roleId: number;

	// %% RELATIONS

	@ManyToOne(() => UserEntity)
	@JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'FK_user_roles_user' })
	user: UserEntity;

	@ManyToOne(() => RoleEntity)
	@JoinColumn({ name: 'role_id', foreignKeyConstraintName: 'FK_user_roles_role' })
	role: RoleEntity;
}
