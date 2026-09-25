import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';

const manifest = JSON.parse(await readFile(new URL('../tests/task-manifest.json', import.meta.url), 'utf8'));
const task = process.env.TASK ?? process.argv[2];
if (!task || !Object.hasOwn(manifest, task)) {
  console.error(`Unknown task ID: ${task ?? '<missing>'}`);
  process.exit(2);
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', env: process.env });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`)));
  });
}

const entry = manifest[task];
const e2eOnly = process.argv.includes('--e2e');
const opsOnly = process.argv.includes('--ops');
const unitFiles = opsOnly || e2eOnly ? [] : [...(entry.api ?? []), ...(entry.web ?? [])];
const opsFiles = e2eOnly ? [] : (entry.ops ?? []);
const e2eFiles = e2eOnly ? (entry.e2e ?? []) : [];
const selected = [...unitFiles, ...opsFiles, ...e2eFiles];
if (selected.length === 0) {
  console.error(`Task ${task} has no registered ${e2eOnly ? 'e2e' : opsOnly ? 'ops' : 'test'} files`);
  process.exit(2);
}
await Promise.all(selected.map(file => access(file)));
if (unitFiles.length) await run('npx', ['vitest', 'run', ...unitFiles]);
for (const file of opsFiles) await run('sh', [file]);
if (e2eFiles.length) await run('npx', ['playwright', 'test', ...e2eFiles]);
