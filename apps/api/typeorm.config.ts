import 'dotenv/config';
import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { createRequire } from 'module';
const cjsRequire = createRequire(__filename);
const { appEnvironment } = cjsRequire('./src/app/config/env.module.ts');

const env = appEnvironment as typeof appEnvironment;

const dataSource = new DataSource({
  type: 'postgres',
  url: env.DATABASE_URL,
  // Keep the globs tight so TypeORM does not evaluate unrelated compiled files
  // (e.g. dist/apps/api/main.js) when loading metadata for CLI commands.
  entities: [
    'apps/api/src/app/database/entities/*.ts',
    'dist/apps/api/src/app/database/entities/*.js',
  ],
  migrations: [
    'apps/api/src/database/migrations/*.ts',
    'dist/apps/api/src/database/migrations/*.js',
  ],
  namingStrategy: new SnakeNamingStrategy(),
  migrationsTableName: 'kouru_schema_migrations',
  synchronize: false,
  logging: ['error', 'warn'],
});

export default dataSource;
