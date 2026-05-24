import {
	IsBoolean,
	IsEmail,
	IsNotEmpty,
	IsNumber,
	IsOptional,
	IsString,
	Length,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { BaseDto } from 'src/commons/base.dtos';

export class CreateUserDto extends BaseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	document_type_id: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	document_code: number;

	@IsString()
	@Length(1, 1000)
	@ApiProperty({ example: 'first_name_example', required: true })
	first_name: string;

	@IsString()
	@Length(1, 1000)
	@ApiProperty({ example: 'last_name_example', required: true })
	last_name: string;

	@IsEmail()
	@ApiProperty({ example: 'user@example.com', required: true })
	email: string;

	@IsString()
	@Length(1, 1000)
	@ApiProperty({ example: 'phone_example', required: true })
	phone: string;

	@IsBoolean()
	@ApiProperty({ example: true, required: true })
	is_admin: boolean;
}

export class UpdateUserDto extends BaseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	document_type_id?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	document_code?: number;

	@IsOptional()
	@IsString()
	@Length(1, 1000)
	@ApiProperty({ example: 'first_name_example', required: false })
	first_name?: string;

	@IsOptional()
	@IsString()
	@Length(1, 1000)
	@ApiProperty({ example: 'last_name_example', required: false })
	last_name?: string;

	@IsOptional()
	@IsEmail()
	@ApiProperty({ example: 'user@example.com', required: false })
	email?: string;

	@IsOptional()
	@IsString()
	@Length(1, 1000)
	@ApiProperty({ example: 'phone_example', required: false })
	phone?: string;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	is_admin?: boolean;
}

export class FilterUserDto extends BaseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	document_type_id?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	document_code?: number;

	@IsOptional()
	@ApiProperty({ example: 'first_name_example', required: false })
	first_name?: string;

	@IsOptional()
	@ApiProperty({ example: 'last_name_example', required: false })
	last_name?: string;

	@IsOptional()
	@IsEmail()
	@ApiProperty({ example: 'user@example.com', required: false })
	email?: string;

	@IsOptional()
	@ApiProperty({ example: 'phone_example', required: false })
	phone?: string;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	is_admin?: boolean;
}

// %% OTHERS DTO
export class LoginUserByCredentialsDto {
	@IsString()
	@IsNotEmpty()
	@ApiProperty({
		example: 'EISCB',
		required: true,
		description: 'Código de la escuela seleccionada por el usuario',
	})
	school_code: string;

	@IsEmail()
	@ApiProperty({
		example: 'juan.perez@example.com',
		required: true,
	})
	email: string;

	@IsString()
	@ApiProperty({
		example: 'password123',
		required: true,
	})
	password: string;
}

export class ChangeRoleDto {
	@IsNumber()
	@ApiProperty({ example: 2 })
	newRole: number;
}
