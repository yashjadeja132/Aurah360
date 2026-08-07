/**
 * PM2 ecosystem — production process manager for the API.
 * Usage: pm2 start ecosystem.config.cjs --env production
 */
module.exports = {
  apps: [
    {
      name: 'aurah360-api',
      cwd: './backend',
      script: 'src/server.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
      error_file: './backend/logs/pm2-error.log',
      out_file: './backend/logs/pm2-out.log',
      merge_logs: true,
      time: true,
    },
  ],
};
