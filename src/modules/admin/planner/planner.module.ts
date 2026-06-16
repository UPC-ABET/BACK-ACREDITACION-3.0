import { Module } from '@nestjs/common';
import { PlannerTokenModule } from './planner-token/planner-token.module';
import { PlannerScraperModule } from './scraper/planner-scraper.module';

// Planner (u-planner) scraping. Complements Banner: Banner captures sections/enrollment/
// students/teachers; Planner captures the evaluation structure and student grades.
@Module({
	imports: [PlannerTokenModule, PlannerScraperModule],
})
export class PlannerModule {}
