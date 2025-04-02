module.exports = {
  development:{
    DBUSER: process.env.MYSQL_USER || 'root',
    DBHOST: process.env.MYSQL_HOST || 'localhost',
    DBPASS: process.env.MYSQL_PASS || '',
    DBDB: 'cron_test',
    WAMPURL: process.env.WAMPURL || 'wss://ubuntuserver.outlawdesigns.io:9700/ws',
    WAMPREALM: process.env.WAMPREALM || 'realm1'
  },
  testing:{
    DBUSER: process.env.MYSQL_USER || 'root',
    DBHOST: process.env.MYSQL_HOST || 'localhost',
    DBPASS: process.env.MYSQL_PASS || '',
    DBDB:'cron_test',
    WAMPURL: process.env.WAMPURL || 'wss://ubuntuserver.outlawdesigns.io:9700/ws',
    WAMPREALM: process.env.WAMPREALM || 'realm1'
  },
  production:{
    DBUSER: process.env.MYSQL_USER || 'root',
    DBHOST: process.env.MYSQL_HOST || 'localhost',
    DBPASS: process.env.MYSQL_PASS || '',
    DBDB:'cron',
    WAMPURL: process.env.WAMPURL || 'wss://ubuntuserver.outlawdesigns.io:9700/ws',
    WAMPREALM: process.env.WAMPREALM || 'realm1'
  }
};
