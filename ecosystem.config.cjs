// ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: 'linnworks-app',
      cwd: '/var/www/html/linnworks.cykero.eu',
      script: 'dist/src/main.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      autorestart: true,
      max_memory_restart: '512M',
      node_args: ['--enable-source-maps'],
      env_file: '.env',
      out_file: './logs/app.out.log',
      error_file: './logs/app.err.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      time: true,
    },
  ],
};
