import { ApiProperty } from '@nestjs/swagger';

export class PingResponseDto {
	@ApiProperty()
	ok: boolean;

	@ApiProperty()
	timestamp: string;
}
