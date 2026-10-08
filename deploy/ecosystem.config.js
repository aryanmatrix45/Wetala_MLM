// PM2 Process Manager Configuration
// Usage on server:
// pm2 start deploy/ecosystem.config.js
// pm2 save
// pm2 startup

module.exports = {
  apps: [
    {
      name: 'panchveda-backend',
      cwd: './backend',
      script: 'dist/server.js',
      instances: 'max', // Scale across available CPU cores (or set to 1)
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
    },
  ],
};
