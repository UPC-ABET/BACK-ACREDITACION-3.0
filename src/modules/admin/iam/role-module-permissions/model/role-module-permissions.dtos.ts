import { IsBoolean, IsNumber, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateRoleModulePermissionDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extraValue' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	roleId: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true, description: 'Type id of a module (group TG2001)' })
	moduleTypeId: number;

	@IsNumber()
	@ApiProperty({
		example: 1,
		required: true,
		description: 'Type id of a permission (group TG2000)',
	})
	permissionTypeId: number;
}

export class UpdateRoleModulePermissionDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extraValue' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	roleId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	moduleTypeId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	permissionTypeId?: number;
}

export class FilterRoleModulePermissionDto {
	@IsOptional()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	roleId?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	moduleTypeId?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	permissionTypeId?: number;
}
