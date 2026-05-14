import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AccreditorEntity } from './model/accreditors.entity';
import { AccreditorRepository } from './core/accreditors.repository';
import { AccreditorService } from './api/accreditors.service';
import { AccreditorController } from './api/accreditors.controller';

@Module({
	imports: [TypeOrmModule.forFeature([AccreditorEntity])],
	controllers: [AccreditorController],
	providers: [AccreditorService, AccreditorRepository],
	exports: [AccreditorService, AccreditorRepository],
})
export class AccreditorModule {}
