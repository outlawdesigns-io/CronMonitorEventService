process.env.NODE_ENV = process.env.NODE_ENV || 'development';
//configure SDK db connection
process.env.MYSQL_HOST = process.env.MYSQL_HOST || 'localhost';
process.env.MYSQL_USER = process.env.MYSQL_USER || 'root';
process.env.MYSQL_PASS = process.env.MYSQL_PASS || 'example';
process.env.MYSQL_CRON_DB = process.env.MYSQL_CRON_DB || 'cron_test';
process.env.POLL_LENGTH = process.env.POLL_LENGTH || 3000 //poll for job updates
//configure oath settings
process.env.AUTH_DISCOVERY_URI = process.env.AUTH_DISCOVERY_URI || 'https://auth.outlawdesigns.io/.well-known/openid-configuration';
process.env.AUTH_CLIENT_ID =  process.env.AUTH_CLIENT_ID || 'cronsuite-events';
process.env.AUTH_CLIENT_SECRET = process.env.AUTH_CLIENT_SECRET || '12345';
process.env.AUTH_CLIENT_AUDIENCE = process.env.AUTH_CLIENT_AUDIENCE || 'wamp-client';
process.env.AUTH_CLIENT_SCOPE = process.env.AUTH_CLIENT_SCOPE || 'openid, profile, email, roles';
//configure WAMP connection
process.env.WAMPURL = process.env.WAMPURL || 'ws://localhost:8081/ws'
process.env.WAMPREALM = process.env.WAMPREALM || 'oauth2'
process.env.AVG_EXEC_MULTIPLIER = process.env.AVG_EXEC_MULTIPLIER || 3;


export default {
  MYSQL_APP_ID: Math.floor(Math.random() * 4294967295) //random number between 1 and 4294967295 to differential this app from any other listeners
};
