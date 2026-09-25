import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', env: process.env });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`)));
  });
}

const manifest = JSON.parse(await readFile(new URL('../tests/task-manifest.json', import.meta.url), 'utf8'));
const tests = [...new Set(Object.values(manifest).flatMap(entry => [...(entry.api ?? []), ...(entry.web ?? [])]))];

await run('npm', ['run', 'typecheck']);
await run('npm', ['run', 'lint']);
if (tests.length) await run('npx', ['vitest', 'run', ...tests]);
await run('npm', ['run', 'build']);
