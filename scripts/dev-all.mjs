/**
 * Sobe collab-server, espera /health, depois Vite dev (Windows + Linux).
 */
import {
  VITE_PORT,
  getCollabPort,
  collabHealthUrl,
  freePort,
  waitForHealth,
  createProcessRunner,
} from './lib/board-runtime.mjs';

const LOG = '[dev:all]';
const port = getCollabPort();
const healthUrl = collabHealthUrl(port);
const { run, shutdown } = createProcessRunner(LOG);

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

console.log(`${LOG} collab porta ${port} (server/collab-server/.env)`);
console.log(`${LOG} liberando portas antigas (${port} + ${VITE_PORT})...`);
freePort(port, LOG);
freePort(VITE_PORT, LOG);
await new Promise((r) => setTimeout(r, 600));

run('collab', 'npm', ['run', 'dev:collab']);

try {
  await waitForHealth(healthUrl, 60000, LOG);
} catch (err) {
  console.error(`${LOG}`, err.message);
  shutdown(1);
}

run('vite', 'npm', ['run', 'dev']);
