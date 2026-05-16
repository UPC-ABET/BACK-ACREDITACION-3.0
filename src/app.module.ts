import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';

import { AppController } from './app.controller';
import { AppService } from './app.service';

/* =========================
 * AUTH
 * ========================= */
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './modules/auth/protocols/jwt/guards/jwt-auth.guard';
import { JwtStrategy } from './modules/auth/protocols/jwt/strategies/jwt.strategy';

// ACADEMIC MODULES
import { AcademicPeriodModule } from './modules/academic/academic-periods/academic-periods.module';
import { CourseOutcomeMappingModule } from './modules/academic/course-outcome-mappings/course-outcome-mappings.module';
import { CourseSectionModule } from './modules/academic/course-sections/course-sections.module';
import { CourseModule } from './modules/academic/courses/courses.module';
import { EnrolledStudentModule } from './modules/academic/enrolled-students/enrolled-students.module';
import { PerformanceLevelModule } from './modules/academic/performance-levels/performance-levels.module';
import { ProfessorModule } from './modules/academic/professors/professors.module';
import { ProgramModule } from './modules/academic/programs/programs.module';
import { StudentCourseGradeModule } from './modules/academic/student-course-grades/student-course-grades.module';
import { StudentSectionEnrollmentModule } from './modules/academic/student-section-enrollments/student-section-enrollments.module';
import { StudentModule } from './modules/academic/students/students.module';
import { StudyPlanAcademicPeriodModule } from './modules/academic/study-plan-academic-periods/study-plan-academic-periods.module';
import { StudyPlanCourseModule } from './modules/academic/study-plan-courses/study-plan-courses.module';
import { StudyPlanModule } from './modules/academic/study-plans/study-plans.module';

//ACCREDITATION MODULES
import { AccreditorModule } from './modules/accreditation/accreditors/accreditors.module';
import { CommissionModule } from './modules/accreditation/commissions/commissions.module';
import { OutcomeModule } from './modules/accreditation/outcomes/outcomes.module';
import { ProgramCommissionModule } from './modules/accreditation/program-commissions/program-commissions.module';

//CORE MODULES
import { ParameterModule } from './modules/core/parameters/parameters.module';
import { TypeGroupModule } from './modules/core/type-groups/type-groups.module';
import { TypeModule } from './modules/core/types/types.module';

//EVALUATION MODULES
import { ProjectEvaluatorModule } from './modules/evaluation/project-evaluators/project-evaluators.module';
import { ProjectStudentModule } from './modules/evaluation/project-students/project-students.module';
import { ProjectModule } from './modules/evaluation/projects/projects.module';
import { RubricOutcomeCriteriaModule } from './modules/evaluation/rubric-outcome-criterias/rubric-outcome-criterias.module';
import { RubricQuestionCriteriaModule } from './modules/evaluation/rubric-question-criterias/rubric-question-criterias.module';
import { RubricQuestionModule } from './modules/evaluation/rubric-questions/rubric-questions.module';
import { RubricScaleModule } from './modules/evaluation/rubric-scales/rubric-scales.module';
import { RubricScoreModule } from './modules/evaluation/rubric-scores/rubric-scores.module';
import { RubricModule } from './modules/evaluation/rubrics/rubrics.module';

//EVIDENCE MODULES
import { EvaluationModule } from './modules/evidence/evaluations/evaluations.module';
import { IfcModule } from './modules/evidence/ifcs/ifcs.module';
import { InstrumentModule } from './modules/evidence/instruments/instruments.module';
import { StudentCourseOutcomeGradeModule } from './modules/evidence/student-course-outcome-grades/student-course-outcome-grades.module';
import { SurveyModule } from './modules/evidence/surveys/surveys.module';

//IFC MODULES
import { IfcFindingModule } from './modules/ifc/ifc-findings/ifc-findings.module';
import { StatusModule } from './modules/ifc/statuses/statuses.module';

//IMPROVEMENT MODULES
import { ActionModule } from './modules/improvement/actions/actions.module';
import { FindingActionModule } from './modules/improvement/finding-actions/finding-actions.module';
import { FindingOutcomeModule } from './modules/improvement/finding-outcomes/finding-outcomes.module';
import { FindingModule } from './modules/improvement/findings/findings.module';
import { PlanActionModule } from './modules/improvement/plan-actions/plan-actions.module';
import { PlanModule } from './modules/improvement/plans/plans.module';

//ORGANIZATION MODULES
import { CampusModule } from './modules/organization/campuses/campuses.module';
import { ChartLevelModule } from './modules/organization/chart-levels/chart-levels.module';
import { ChartModule } from './modules/organization/charts/charts.module';
import { FacultyModule } from './modules/organization/faculties/faculties.module';
import { SchoolModule } from './modules/organization/schools/schools.module';
import { StaffModule } from './modules/organization/staff/staff.module';
import { UserModule } from './modules/organization/users/users.module';

//SURVEY MODULES
import { NotificationMessageModule } from './modules/survey/notification-messages/notification-messages.module';
import { NotificationModule } from './modules/survey/notifications/notifications.module';
import { OutcomeConfigModule } from './modules/survey/outcome-configs/outcome-configs.module';
import { ScoreModule } from './modules/survey/scores/scores.module';
import { PppModule } from './modules/survey/ppp/ppp.module';
import { GraModule } from './modules/survey/gra/gra.module';

@Module({
	imports: [
		/* CONFIG */
		ConfigModule.forRoot({
			isGlobal: true,
		}),

		PassportModule.register({ defaultStrategy: 'jwt' }),

		JwtModule.registerAsync({
			global: true,
			inject: [ConfigService],
			useFactory: (configService: ConfigService) => {
				const secret = configService.get<string>('JWT_SECRET');
				return {
					secret,
					signOptions: { expiresIn: '2400h' },
				};
			},
		}),

		/* DATABASE */
		TypeOrmModule.forRootAsync({
			useFactory: async (configService: ConfigService): Promise<TypeOrmModuleOptions> => ({
				type: configService.get<string>('DB_TYPE') as any,
				host: configService.get<string>('DB_HOST'),
				port: configService.get<number>('DB_PORT'),
				username: configService.get<string>('DB_USER'),
				password: configService.get<string>('DB_PASSWORD'),
				database: configService.get<string>('DB_NAME'),
				ssl: configService.get<string>('DB_SSL') === 'true' ? { rejectUnauthorized: false } : false,
				synchronize: false,
				entities: [__dirname + '/**/*.entity{.ts,.js}'],
				timezone: 'Z',
				logging: ['error'],
				extra: {
					max: 10,
					idleTimeoutMillis: 30000,
					connectionTimeoutMillis: 5000,
					keepAlive: true,
				},
			}),
			inject: [ConfigService],
		}),

		/* MODULES */
		UserModule,
		AcademicPeriodModule,
		CourseOutcomeMappingModule,
		CourseSectionModule,
		CourseModule,
		EnrolledStudentModule,
		PerformanceLevelModule,
		ProfessorModule,
		ProgramModule,
		StudentCourseGradeModule,
		StudentSectionEnrollmentModule,
		StudentModule,
		StudyPlanAcademicPeriodModule,
		StudyPlanCourseModule,
		StudyPlanModule,
		AccreditorModule,
		CommissionModule,
		OutcomeModule,
		ProgramCommissionModule,
		ParameterModule,
		TypeGroupModule,
		TypeModule,
		RubricOutcomeCriteriaModule,
		RubricQuestionCriteriaModule,
		RubricQuestionModule,
		RubricScaleModule,
		RubricScoreModule,
		RubricModule,
		EvaluationModule,
		IfcModule,
		InstrumentModule,
		StudentCourseOutcomeGradeModule,
		SurveyModule,
		IfcFindingModule,
		StatusModule,
		ActionModule,
		FindingActionModule,
		FindingOutcomeModule,
		FindingModule,
		PlanActionModule,
		PlanModule,
		CampusModule,
		ChartLevelModule,
		ChartModule,
		FacultyModule,
		SchoolModule,
		StaffModule,
		NotificationMessageModule,
		NotificationModule,
		OutcomeConfigModule,
		ScoreModule,
		PppModule,
		GraModule,
		ProjectEvaluatorModule,
		ProjectStudentModule,
		ProjectModule,
	],
	controllers: [AppController],
	providers: [
		AppService,
		JwtStrategy,
		{
			provide: APP_GUARD,
			useClass: JwtAuthGuard,
		},
	],
})
export class AppModule {}
