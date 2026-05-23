/**
 * VPS: build front + verificar back, depois collab (PORT do .env) + preview Vite (5174).
 * Mesmas portas que dev:all; qualquer falha imprime ERRO e termina com código ≠ 0.
 */
import {
  VITE_PORT,
  getCollabPort,
  collabHealthUrl,
  freePort,
  waitForHealth,
  createProcessRunner,
  runStepOrExit,
  assertCollabEnv,
  assertDistBuild,
} from './lib/board-runtime.mjs';

const LOG = '[start:vps]';
const port = getCollabPort();
const healthUrl = collabHealthUrl(port);

console.log(`${LOG} preparando ambiente de produção local (portas: collab ${port}, front ${VITE_PORT})`);
console.log('');

assertCollabEnv(LOG);

console.log(`${LOG} — build —`);
runStepOrExit(LOG, 'Build do frontend (vite build)', 'npm', ['run', 'build']);
assertDistBuild(LOG);

runStepOrExit(LOG, 'Verificação do backend (testes collab-protocol)', 'npm', [
  'run',
  'test',
  '-w',
  '@dailyways/collab-protocol',
]);
runStepOrExit(LOG, 'Verificação do backend (testes collab-server)', 'npm', [
  'run',
  'test',
  '-w',
  '@dailyways/collab-server',
]);

console.log('');
console.log(`${LOG} — arranque —`);
console.log(`${LOG} liberando portas ${port} e ${VITE_PORT}...`);
freePort(port, LOG);
freePort(VITE_PORT, LOG);
await new Promise((r) => setTimeout(r, 600));

const { run, shutdown } = createProcessRunner(LOG);

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

run('collab', 'npm', ['run', 'start:collab']);

try {
  await waitForHealth(healthUrl, 60000, LOG);
} catch (err) {
  console.error(`${LOG} ERRO:`, err.message);
  console.error(`${LOG} O collab-server não ficou disponível. Revise server/collab-server/.env e logs acima.\n`);
  shutdown(1);
}

console.log(`${LOG} subindo frontend (vite preview :${VITE_PORT})...`);
run('preview', 'npm', ['run', 'preview', '--', '--host', '--port', String(VITE_PORT)]);
