/**
 * PM2 na VPS — dois processos obrigatórios:
 *   pm2 start ecosystem.config.cjs
 *   pm2 save && pm2 startup
 */
module.exports = {
  apps: [
    {
      name: 'dailyways-collab',
      cwd: './server/collab-server',
      script: 'src/index.js',
      interpreter: 'node',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
      max_restarts: 10,
    },
    {
      name: 'dailyways-web',
      cwd: './',
      script: 'npm',
      args: 'run dev -- --host',
      env: {
        NODE_ENV: 'development',
      },
      max_restarts: 10,
    },
  ],
};
