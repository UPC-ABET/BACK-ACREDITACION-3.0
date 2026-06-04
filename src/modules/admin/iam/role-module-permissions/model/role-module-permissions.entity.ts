import { Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import { IntegerFKIDColumn } from 'src/commons/configs/db.configs';
import { RoleEntity } from 'src/modules/admin/iam/roles/model/roles.entity';
import { TypeEntity } from 'src/modules/core/types/model/types.entity';

@Entity({ name: 'role_module_permissions', schema: 'core' })
export class RoleModulePermissionEntity extends BaseEntity {
	// %% ATTRIBUTES

	@IntegerFKIDColumn({ nullable: false })
	roleId: number;

	@IntegerFKIDColumn({ nullable: false })
	moduleTypeId: number;

	@IntegerFKIDColumn({ nullable: false })
	permissionTypeId: number;

	// %% RELATIONS

	@ManyToOne(() => RoleEntity)
	@JoinColumn({ name: 'role_id', foreignKeyConstraintName: 'FK_rmp_role' })
	role: RoleEntity;

	@ManyToOne(() => TypeEntity)
	@JoinColumn({ name: 'module_type_id', foreignKeyConstraintName: 'FK_rmp_module_type' })
	moduleType: TypeEntity;

	@ManyToOne(() => TypeEntity)
	@JoinColumn({ name: 'permission_type_id', foreignKeyConstraintName: 'FK_rmp_permission_type' })
	permissionType: TypeEntity;
}
