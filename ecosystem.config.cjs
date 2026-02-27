module.exports = {
  apps: [{
    name: 'eb-navigation-web',
    script: 'node_modules/vite/bin/vite.js',
    args: '--port 3030',
    cwd: 'C:/WorkSpace/eb-navigation-web',
    watch: false,
    env: {
      NODE_ENV: 'development'
    }
  }]
};
