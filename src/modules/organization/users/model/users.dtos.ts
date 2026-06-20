// no-override — hand-curated validators (@IsEmail, etc.); generator skips this file.
import {
	IsBoolean,
	IsEmail,
	IsNotEmpty,
	IsNumber,
	IsOptional,
	IsString,
	Length,
	MaxLength,
	MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { PaginationQueryDto } from 'src/commons/pagination.dtos';

export class ListUsersQueryDto extends PaginationQueryDto {
	@IsOptional()
	@Transform(({ value }) => value === true || value === 'true')
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	unlinkedOnly?: boolean;

	@IsOptional()
	@IsString()
	@ApiProperty({
		example: 'searchExample',
		required: false,
		description: 'Search by user first name / last name / email / linked professor code',
	})
	search?: string;
}

export class CreateUserDto {
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
	documentTypeId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	documentCode?: number;

	@IsString()
	@Length(1, 1000)
	@ApiProperty({ example: 'firstNameExample', required: true })
	firstName: string;

	@IsString()
	@Length(1, 1000)
	@ApiProperty({ example: 'lastNameExample', required: true })
	lastName: string;

	@IsEmail()
	@MaxLength(254)
	@ApiProperty({ example: 'user@example.com', required: true })
	email: string;

	@IsOptional()
	@IsString()
	@Length(1, 1000)
	@ApiProperty({ example: '+51 999 999 999', required: false })
	phone?: string;

	@IsOptional()
	@IsNumber()
	@ApiProperty({
		example: 1,
		required: false,
		description: 'organization.staff id to link to this user (e.g. a teacher created on load)',
	})
	staffId?: number | null;
}

export class UpdateUserDto {
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
	documentTypeId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	documentCode?: number;

	@IsOptional()
	@IsString()
	@Length(1, 1000)
	@ApiProperty({ example: 'firstNameExample', required: false })
	firstName?: string;

	@IsOptional()
	@IsString()
	@Length(1, 1000)
	@ApiProperty({ example: 'lastNameExample', required: false })
	lastName?: string;

	@IsOptional()
	@IsEmail()
	@MaxLength(254)
	@ApiProperty({ example: 'user@example.com', required: false })
	email?: string;

	@IsOptional()
	@IsString()
	@Length(1, 1000)
	@ApiProperty({ example: '+51 999 999 999', required: false })
	phone?: string;

	@IsOptional()
	@IsNumber()
	@ApiProperty({
		example: 1,
		required: false,
		nullable: true,
		description:
			'organization.staff id to link to this user; null unlinks the currently linked staff',
	})
	staffId?: number | null;
}

export class FilterUserDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extraValue' }, required: false })
	extra?: any;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	documentTypeId?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	documentCode?: number;

	@IsOptional()
	@ApiProperty({ example: 'firstNameExample', required: false })
	firstName?: string;

	@IsOptional()
	@ApiProperty({ example: 'lastNameExample', required: false })
	lastName?: string;

	@IsOptional()
	@IsEmail()
	@MaxLength(254)
	@ApiProperty({ example: 'user@example.com', required: false })
	email?: string;

	@IsOptional()
	@ApiProperty({ example: '+51 999 999 999', required: false })
	phone?: string;
}

// %% OTHER DTOS
export class LoginUserByCredentialsDto {
	@IsEmail()
	@MaxLength(254)
	@ApiProperty({
		example: 'user@example.com',
		required: true,
	})
	email: string;

	@IsString()
	@MinLength(8)
	@ApiProperty({
		example: 'passwordExample',
		required: true,
	})
	password: string;
}

export class GetMeDto {
	@IsString()
	@IsNotEmpty()
	@ApiProperty({ example: 'TG102-T001', required: true, description: 'Program modality code' })
	modalityCode: string;
}
