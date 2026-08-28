import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { UpperPrefixSnakeNamingStrategy } from './commons/configs/naming-strategy';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EncryptModule } from './libs/encrypt.module';
import { validateEnv } from './commons/configs/env.config';

import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './modules/auth/protocols/jwt/guards/jwt-auth.guard';
import { PermissionsGuard } from './modules/auth/protocols/jwt/guards/permissions.guard';
import { ApiTokenAuthGuard } from './modules/auth/protocols/api-key/guards/api-token-auth.guard';
import { JwtStrategy } from './modules/auth/protocols/jwt/strategies/jwt.strategy';
import { JWT_EXPIRES_IN, getRequiredJwtSecret } from './modules/auth/protocols/jwt/jwt.config';
import { AuthModule } from './modules/auth/auth.module';

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

import { AccreditorModule } from './modules/accreditation/accreditors/accreditors.module';
import { CommissionModule } from './modules/accreditation/commissions/commissions.module';
import { OutcomeModule } from './modules/accreditation/outcomes/outcomes.module';
import { ProgramCommissionModule } from './modules/accreditation/program-commissions/program-commissions.module';
import { OutcomeConversionsModule } from './modules/accreditation/outcome-conversions/outcome-conversions.module';
import { ProcessedRvGradesModule } from './modules/academic/processed-rv-grades/processed-rv-grades.module';

import { ParameterModule } from './modules/core/parameters/parameters.module';
import { EmailTemplateModule } from './modules/core/email-templates/email-templates.module';
import { TypeGroupModule } from './modules/core/type-groups/type-groups.module';
import { TypeModule } from './modules/core/types/types.module';

import { ProjectEvaluatorModule } from './modules/evaluation/project-evaluators/project-evaluators.module';
import { ProjectStudentModule } from './modules/evaluation/project-students/project-students.module';
import { ProjectModule } from './modules/evaluation/projects/projects.module';
import { ProjectGroupModule } from './modules/evaluation/project-groups/project-groups.module';
import { RubricQuestionCriteriaModule } from './modules/evaluation/rubric-question-criterias/rubric-question-criterias.module';
import { RubricQuestionModule } from './modules/evaluation/rubric-questions/rubric-questions.module';
import { RubricModule } from './modules/evaluation/rubrics/rubrics.module';
import { SemaphoreReportsModule } from './modules/evaluation/semaphore-reports/semaphore-reports.module';

import { EvaluationModule } from './modules/evidence/evaluations/evaluations.module';
import { ArdModule } from './modules/evidence/ards/ards.module';
import { IfcModule } from './modules/evidence/ifcs/ifcs.module';
import { InstrumentModule } from './modules/evidence/instruments/instruments.module';
import { StudentCourseOutcomeGradeModule } from './modules/evidence/student-course-outcome-grades/student-course-outcome-grades.module';
import { SurveyModule } from './modules/evidence/surveys/surveys.module';

import { IfcFindingModule } from './modules/ifc/ifc-findings/ifc-findings.module';
import { StatusModule } from './modules/ifc/statuses/statuses.module';
import { NotificationLogModule } from './modules/core/notification-logs/notification-logs.module';

import { ActionModule } from './modules/improvement/actions/actions.module';
import { FindingActionModule } from './modules/improvement/finding-actions/finding-actions.module';
import { FindingOutcomeModule } from './modules/improvement/finding-outcomes/finding-outcomes.module';
import { FindingModule } from './modules/improvement/findings/findings.module';
import { PlanActionModule } from './modules/improvement/plan-actions/plan-actions.module';
import { PlanModule } from './modules/improvement/plans/plans.module';

import { CampusModule } from './modules/organization/campuses/campuses.module';
import { ChartModule } from './modules/organization/charts/charts.module';
import { FacultyModule } from './modules/organization/faculties/faculties.module';
import { SchoolModule } from './modules/organization/schools/schools.module';
import { StaffModule } from './modules/organization/staff/staff.module';
import { UserModule } from './modules/organization/users/users.module';
import { OrgScopeModule } from './modules/organization/org-scope/org-scope.module';

import { NotificationMessageModule } from './modules/survey/notification-messages/notification-messages.module';
import { NotificationModule } from './modules/survey/notifications/notifications.module';
import { OutcomeConfigModule } from './modules/survey/outcome-configs/outcome-configs.module';
import { ScoreModule } from './modules/survey/scores/scores.module';
import { PppModule } from './modules/survey/ppp/ppp.module';
import { GraModule } from './modules/survey/gra/gra.module';
import { LcfcModule } from './modules/survey/lcfc/lcfc.module';

import { UploadsModule } from './modules/uploads/uploads.module';

import { BannerModule } from './modules/admin/banner/banner.module';
import { PlannerModule } from './modules/admin/planner/planner.module';
import { ScrapingExportsModule } from './modules/admin/scraping-exports/scraping-exports.module';
import { ConfigurationModule } from './modules/admin/configuration/configuration.module';
import { NotificationConfigModule } from './modules/admin/ifc/notification-configs/notification-configs.module';
import { ChartHeadsModule } from './modules/admin/organization/chart-heads/chart-heads.module';
import { RoleModule } from './modules/admin/iam/roles/roles.module';
import { UserRoleModule } from './modules/admin/iam/user-roles/user-roles.module';
import { RoleModulePermissionModule } from './modules/admin/iam/role-module-permissions/role-module-permissions.module';
import { ApiTokenModule } from './modules/admin/iam/api-tokens/api-tokens.module';
import { IntegrationKeyModule } from './modules/admin/iam/integration-keys/integration-keys.module';
import { PortfolioSsoModule } from './modules/admin/iam/portfolio-sso/portfolio-sso.module';
import { IntegrationsHealthModule } from './modules/integrations/health/health.module';
import { AcademicSyncModule } from './modules/integrations/academic-sync/academic-sync.module';
import { ClassRepresentativesUploadModule } from 'src/modules/uploads/class-representatives/class-representatives-upload.module';

import { ClassRepresentativesModule } from './modules/academic/class-representatives/class-representatives.module';

@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true,
			validate: validateEnv,
		}),

		EncryptModule,

		CacheModule.register({
			isGlobal: true,
			ttl: 30_000,
			max: 1000,
		}),

		PassportModule.register({ defaultStrategy: 'jwt' }),

		JwtModule.registerAsync({
			global: true,
			inject: [ConfigService],
			useFactory: (configService: ConfigService) => {
				return {
					secret: getRequiredJwtSecret(configService),
					signOptions: { expiresIn: JWT_EXPIRES_IN },
				};
			},
		}),

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
				autoLoadEntities: true,
				timezone: 'Z',
				logging: ['error', 'warn'],
				namingStrategy: new UpperPrefixSnakeNamingStrategy(),
				extra: {
					max: configService.get<number>('DB_POOL_MAX'),
					idleTimeoutMillis: configService.get<number>('DB_POOL_IDLE_TIMEOUT'),
					connectionTimeoutMillis: configService.get<number>('DB_POOL_CONN_TIMEOUT'),
					keepAlive: true,
				},
			}),
			inject: [ConfigService],
		}),

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
		ClassRepresentativesModule,
		ClassRepresentativesUploadModule,
		StudentModule,
		StudyPlanAcademicPeriodModule,
		StudyPlanCourseModule,
		StudyPlanModule,
		AccreditorModule,
		CommissionModule,
		OutcomeModule,
		ProgramCommissionModule,
		OutcomeConversionsModule,
		ProcessedRvGradesModule,
		ParameterModule,
		EmailTemplateModule,
		TypeGroupModule,
		TypeModule,
		RubricQuestionCriteriaModule,
		RubricQuestionModule,
		RubricModule,
		SemaphoreReportsModule,
		ArdModule,
		EvaluationModule,
		IfcModule,
		InstrumentModule,
		StudentCourseOutcomeGradeModule,
		SurveyModule,
		AuthModule,
		IfcFindingModule,
		StatusModule,
		NotificationConfigModule,
		ChartHeadsModule,
		NotificationLogModule,
		ActionModule,
		FindingActionModule,
		FindingOutcomeModule,
		FindingModule,
		PlanActionModule,
		PlanModule,
		CampusModule,
		ChartModule,
		FacultyModule,
		SchoolModule,
		StaffModule,
		OrgScopeModule,
		NotificationMessageModule,
		NotificationModule,
		OutcomeConfigModule,
		ScoreModule,
		PppModule,
		GraModule,
		LcfcModule,
		ProjectEvaluatorModule,
		ProjectStudentModule,
		ProjectModule,
		ProjectGroupModule,
		UploadsModule,
		ConfigurationModule,
		RoleModule,
		UserRoleModule,
		RoleModulePermissionModule,
		ApiTokenModule,
		IntegrationKeyModule,
		PortfolioSsoModule,
		IntegrationsHealthModule,
		AcademicSyncModule,
		...(process.env.RAW_DB_URL ? [BannerModule, PlannerModule, ScrapingExportsModule] : []),
	],
	controllers: [AppController],
	providers: [
		AppService,
		JwtStrategy,
		{
			provide: APP_GUARD,
			useClass: ApiTokenAuthGuard,
		},
		{
			provide: APP_GUARD,
			useClass: JwtAuthGuard,
		},
		{
			provide: APP_GUARD,
			useClass: PermissionsGuard,
		},
	],
})
export class AppModule {}
