module.exports = {
  apps: [{
    name: 'speculumx-blog',
    script: 'server.js',
    cwd: '/var/www/blog',
    env_production: {
      NODE_ENV: 'production'
    }
  }]
};
