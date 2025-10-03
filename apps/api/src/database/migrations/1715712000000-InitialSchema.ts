import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1715712000000 implements MigrationInterface {
  name = 'InitialSchema1715712000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email text UNIQUE NOT NULL,
        password_hash text NOT NULL,
        display_name text NOT NULL,
        avatar_url text,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS spaces (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_id uuid NOT NULL REFERENCES users(id),
        name text NOT NULL,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS space_members (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        space_id uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role text NOT NULL DEFAULT 'user',
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now(),
        UNIQUE(space_id, user_id)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS space_invites (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        space_id uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
        created_by uuid NOT NULL REFERENCES users(id),
        email text NOT NULL,
        role text NOT NULL DEFAULT 'user',
        token text NOT NULL UNIQUE,
        expires_at timestamptz NOT NULL,
        accepted_at timestamptz,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        space_id uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
        name text NOT NULL,
        created_by uuid NOT NULL REFERENCES users(id),
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS docs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        kind text NOT NULL,
        ydoc bytea NOT NULL,
        metadata jsonb,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS doc_snapshots (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        doc_id uuid NOT NULL REFERENCES docs(id) ON DELETE CASCADE,
        ydoc bytea NOT NULL,
        metadata jsonb,
        created_at timestamptz DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS assets (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        space_id uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
        owner_id uuid NOT NULL REFERENCES users(id),
        kind text NOT NULL,
        title text NOT NULL,
        description text,
        price_cents int DEFAULT 0,
        license text DEFAULT 'personal',
        storage_key text NOT NULL,
        preview_url text,
        metadata jsonb,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS project_assets (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        asset_id uuid NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
        placement jsonb,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now(),
        UNIQUE(project_id, asset_id)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS comments (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        author_id uuid NOT NULL REFERENCES users(id),
        body text NOT NULL,
        anchor jsonb,
        category text DEFAULT 'comment',
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        author_id uuid NOT NULL REFERENCES users(id),
        assignee_id uuid REFERENCES users(id),
        title text NOT NULL,
        description text,
        status text DEFAULT 'todo',
        due_at timestamptz,
        anchor jsonb,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_projects_space ON projects(space_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_docs_project ON docs(project_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_assets_space ON assets(space_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_comments_project ON comments(project_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_tasks_project`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_comments_project`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_assets_space`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_docs_project`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_projects_space`);

    await queryRunner.query(`DROP TABLE IF EXISTS tasks`);
    await queryRunner.query(`DROP TABLE IF EXISTS comments`);
    await queryRunner.query(`DROP TABLE IF EXISTS project_assets`);
    await queryRunner.query(`DROP TABLE IF EXISTS assets`);
    await queryRunner.query(`DROP TABLE IF EXISTS doc_snapshots`);
    await queryRunner.query(`DROP TABLE IF EXISTS docs`);
    await queryRunner.query(`DROP TABLE IF EXISTS projects`);
    await queryRunner.query(`DROP TABLE IF EXISTS space_invites`);
    await queryRunner.query(`DROP TABLE IF EXISTS space_members`);
    await queryRunner.query(`DROP TABLE IF EXISTS spaces`);
    await queryRunner.query(`DROP TABLE IF EXISTS users`);
  }
}
