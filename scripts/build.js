#!/usr/bin/env node

const { spawnSync } = require('child_process');

const SUPPORTED_PROJECTS = ['web', 'api'];

const requested = process.argv[2] ? process.argv[2].toLowerCase() : null;

let projects;

if (!requested) {
  projects = SUPPORTED_PROJECTS;
} else if (SUPPORTED_PROJECTS.includes(requested)) {
  projects = [requested];
} else {
  console.error(
    `Unknown project "${requested}". Supported options: ${SUPPORTED_PROJECTS.join(', ')}.`
  );
  process.exit(1);
}

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    ...options,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

for (const project of projects) {
  console.log(`\n◆ Linting ${project}...`);
  run('npx', ['nx', 'lint', project], { env: process.env });

  console.log(`\n◆ Building ${project} (skip cache)...`);
  run('npx', ['nx', 'build', project, '--skip-nx-cache'], { env: process.env });
}

console.log('\n✔ Build pipeline completed.');
