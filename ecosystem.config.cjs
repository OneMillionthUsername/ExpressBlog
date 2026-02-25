module.exports = {
  apps: [
    {
      name: 'speculumx-blog',
      script: 'server.js',
      cwd: '/var/www/blog',

      // Default environment (pm2 start ecosystem.config.cjs)
      env: {
        NODE_ENV: 'development',
        ENV_FILE: '.env.development'
      },

      // pm2 start ecosystem.config.cjs --env development
      env_development: {
        NODE_ENV: 'development',
        ENV_FILE: '.env.development'
      },

      // pm2 start ecosystem.config.cjs --env production
      env_production: {
        NODE_ENV: 'production',
        ENV_FILE: '.env.production'
      }
    }
  ]
};
