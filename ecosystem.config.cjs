// ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: 'linnworks-app',
      script: 'dist/src/main.js',
      instances: 1, // keep 1 due to scheduled jobs
      exec_mode: 'fork',
      watch: false,
      autorestart: true,
      max_memory_restart: '512M',
      node_args: ['--enable-source-maps'],

      // Load your existing .env file; adjust path if needed
      env_file: '.env',

      // Logging (optional but recommended)
      out_file: './logs/app.out.log',
      error_file: './logs/app.err.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      time: true,
    },
  ],
};
