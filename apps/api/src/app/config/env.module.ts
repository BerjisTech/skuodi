import { Global, Module } from '@nestjs/common';
import { validateEnv } from './env.validation';
import { APP_ENV_TOKEN } from './tokens';

export const appEnvironment = validateEnv(process.env);

@Global()
@Module({
  providers: [{ provide: APP_ENV_TOKEN, useValue: appEnvironment }],
  exports: [APP_ENV_TOKEN],
})
export class EnvModule {}
