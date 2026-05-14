import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { InstrumentEntity } from './model/instruments.entity';
import { InstrumentRepository } from './core/instruments.repository';
import { InstrumentService } from './api/instruments.service';
import { InstrumentController } from './api/instruments.controller';

@Module({
	imports: [TypeOrmModule.forFeature([InstrumentEntity])],
	controllers: [InstrumentController],
	providers: [InstrumentService, InstrumentRepository],
	exports: [InstrumentService, InstrumentRepository],
})
export class InstrumentModule {}
