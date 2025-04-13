process.env.NODE_ENV = process.env.NODE_ENV || 'development';
//configure SDK db connection
process.env.MYSQL_HOST = process.env.MYSQL_HOST || 'localhost';
process.env.MYSQL_USER = process.env.MYSQL_USER || 'root';
process.env.MYSQL_PASS = process.env.MYSQL_PASS || 'example';
process.env.MYSQL_CRON_DB = process.env.MYSQL_CRON_DB || 'cron';
//configure WAMP connection
process.env.WAMPURL = process.env.WAMPURL || 'wss://localhost:9700/ws'
process.env.WAMPREALM = process.env.WAMPREALM || 'realm1'


module.exports = {
  POLL_LENGTH:3000,
  MYSQL_APP_ID: 8801 //random number between 1 and 4294967295 do differential this app from any other listeners
};
