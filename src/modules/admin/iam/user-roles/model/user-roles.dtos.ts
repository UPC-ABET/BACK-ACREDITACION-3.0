import { IsBoolean, IsNumber, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserRoleDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extraValue' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	userId: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	roleId: number;
}

export class UpdateUserRoleDto {
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
	userId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	roleId?: number;
}

export class FilterUserRoleDto {
	@IsOptional()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	userId?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	roleId?: number;
}
