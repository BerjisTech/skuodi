import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_ENV_TOKEN, EnvModule, appEnvironment, configuration } from './config';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { SpacesModule } from './modules/spaces/spaces.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { DocsModule } from './modules/docs/docs.module';
import { AssetsModule } from './modules/assets/assets.module';
import { CommentsModule } from './modules/comments/comments.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { RtcModule } from './modules/rtc/rtc.module';
import { PresenceModule } from './modules/presence/presence.module';
import { HealthModule } from './modules/health/health.module';
import { InfrastructureModule } from './modules/infrastructure/infrastructure.module';
import { IoModule } from './modules/io/io.module';

@Module({
  imports: [
    EnvModule,
    ConfigModule.forRoot({
      isGlobal: true,
      load: [() => configuration(appEnvironment)],
      expandVariables: true,
    }),
    InfrastructureModule,
    DatabaseModule,
    AuthModule,
    SpacesModule,
    ProjectsModule,
    DocsModule,
    AssetsModule,
    CommentsModule,
    TasksModule,
    RtcModule,
    PresenceModule,
    IoModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_ENV_TOKEN,
      useValue: appEnvironment,
    },
  ],
})
export class AppModule {}
