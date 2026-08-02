import mysql from 'mysql';
import autobahn from 'autobahn';
import MySQLEvents from '@rodrigogs/mysql-events';
import ModelFactory from '@outlawdesigns/cronmonitorsdk';
import authClient from '@outlawdesigns/authenticationclient';

import config from './config.js'

const POLL_LENGTH = process.env.POLL_LENGTH;
const MYSQL_APP_ID = config.MYSQL_APP_ID;

authClient.onTokenUpdate((tokenSet)=>{
  console.log('New oauth2 token retrieved...');
});
await authClient.init(new URL(process.env.AUTH_DISCOVERY_URI),process.env.AUTH_CLIENT_ID,process.env.AUTH_CLIENT_SECRET);
await authClient.clientCredentialFlow(process.env.AUTH_CLIENT_SCOPE,[process.env.AUTH_CLIENT_AUDIENCE]);

const mysqlConn = mysql.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASS
});

const mysqlEvents = new MySQLEvents(mysqlConn,{
  serverId:MYSQL_APP_ID,
  startAtEnd:true,
  excludeSchemas:{
    mysql:true
  }
});

// const wampConn = new autobahn.Connection({
//   url:process.env.WAMPURL,
//   realm:process.env.WAMPREALM
// });

const wampConn = new autobahn.Connection({
  url: process.env.WAMPURL,
  realm: process.env.WAMPREALM,
  authmethods: ['ticket'],
  authid: process.env.AUTH_CLIENT_ID,
  onchallenge: function(session,method,extra){
    return authClient.getAccessToken();
  }
});

//New Execution
mysqlEvents.addTrigger({
  name:'EXECUTION_TRIGGER',
  expression:`${process.env.MYSQL_CRON_DB}.${ModelFactory.get('execution').table}`,
  statement: MySQLEvents.STATEMENTS.INSERT,
  onEvent: (event) => _executionInsertHandler(event,wampConn)
});
//New Job
mysqlEvents.addTrigger({
  name:'NEWJOB_TRIGGER',
  expression:`${process.env.MYSQL_CRON_DB}.${ModelFactory.get('job').table}`,
  statement: MySQLEvents.STATEMENTS.INSERT,
  onEvent: (event)=> _genericInsertHandler(event,wampConn,'jobCreated')
});
//Job Updated
mysqlEvents.addTrigger({
  name:'UPDATEJOB_TRIGGER',
  expression:`${process.env.MYSQL_CRON_DB}.${ModelFactory.get('job').table}`,
  statement:MySQLEvents.STATEMENTS.UPDATE,
  onEvent: (event)=> _genericUpdateHandler(event,wampConn,'jobChanged')
});
//Job Deleted
mysqlEvents.addTrigger({
  name:'DELETEJOB_TRIGGER',
  expression:`${process.env.MYSQL_CRON_DB}.${ModelFactory.get('job').table}`,
  statement:MySQLEvents.STATEMENTS.DELETE,
  onEvent: (event)=> _genericDeleteHandler(event,wampConn,'jobDeleted')
});
mysqlEvents.addTrigger({
  name: 'NEWSUBSCRIPTION_TRIGGER',
  expression: `${process.env.MYSQL_CRON_DB}.${ModelFactory.get('subscription').table}`,
  statement:MySQLEvents.STATEMENTS.INSERT,
  onEvent: (event) => _genericInsertHandler(event, wampConn,'subscriptionCreated')
});
mysqlEvents.addTrigger({
  name: 'UPDATESUBSCRIPTION_TRIGGER',
  expression: `${process.env.MYSQL_CRON_DB}.${ModelFactory.get('subscription').table}`,
  statement:MySQLEvents.STATEMENTS.UPDATE,
  onEvent: (event) => _genericUpdateHandler(event, wampConn,'subscriptionChanged')
});
mysqlEvents.addTrigger({
  name: 'DELETESUBSCRIPTION_TRIGGER',
  expression: `${process.env.MYSQL_CRON_DB}.${ModelFactory.get('subscription').table}`,
  statement:MySQLEvents.STATEMENTS.DELETE,
  onEvent: (event) => _genericDeleteHandler(event, wampConn,'subscriptionUpdated')
});
mysqlEvents.on(MySQLEvents.EVENTS.CONNECTION_ERROR, console.error);
mysqlEvents.on(MySQLEvents.EVENTS.ZONGJI_ERROR, console.error);


function _executionInsertHandler(event, wampConn){
  let newRow = event.affectedRows[0].after;
  let thisJob = jobs.filter(e => e.id == newRow.jobId);
  if(wampConn.isOpen){
    if(thisJob.length){
      wampConn.session.publish('io.outlawdesigns.cron.executionComplete',[thisJob[0],newRow]);
      console.log('published: io.outlawdesigns.cron.executionComplete');
    }else{
      //an execution has been inserted for a disabled or unregisted job.
      wampConn.session.publish('io.outlawdesigns.cron.illegalExecution',[newRow]);
      console.log('published: io.outlawdesigns.cron.illegalExecution');
    }
  }else{
    console.error('WAMP connection is not open')
  }
}

function _genericInsertHandler(event, wampConn, eventName){
  let newRow = event.affectedRows[0].after;
  if(wampConn.isOpen){
    let publishStr = `io.outlawdesigns.cron.${eventName}`;
    console.log(`published: ${publishStr}`);
    wampConn.session.publish(publishStr, [newRow]);
  }
}
function _genericUpdateHandler(event, wampConn, eventName){
  let before = event.affectedRows[0].before;
  let after = event.affectedRows[0].after;
  if(wampConn.isOpen){
    let publishStr = `io.outlawdesigns.cron.${eventName}`;
    console.log(`published: ${publishStr}`);
    wampConn.session.publish(publishStr, [before,after]);
  }
}
function _genericDeleteHandler(event, wampConn, eventName){
  let before = event.affectedRows[0].before;
  if(wampConn.isOpen){
    let publishStr = `io.outlawdesigns.cron.${eventName}`;
    console.log(`published: ${publishStr}`);
    wampConn.session.publish(publishStr,[before]);
  }
}

async function _getJobList(){
  let jobList = (await ModelFactory.getClass('job').getAll()).filter(e => !e.disabled);
  return jobList;
}
async function _checkForOverdue(jobsArr, session){
  for(let i in jobsArr){
    let job;
    let lastExec;
    try{
      job = await ModelFactory.get('job',jobsArr[i].id).init();
      lastExec = await ModelFactory.getClass('execution').getLast(job.id); //throws error if no exec history
    }catch(err){
      // console.error(err);
      continue;
    }
    let now = new Date().getTime();
    let expectedLastRun = job.getExecutionInterval().prev().toString();
    let avgExecSec = await ModelFactory.getClass('execution').getAverageExecutionTime(job.id);
    let estCompletion = Date.parse(expectedLastRun) + (_getTimeoutDelay(avgExecSec) * process.env.AVG_EXEC_MULTIPLIER); //multiply delay to limit false positives
    if(Date.parse(lastExec.endTime) < Date.parse(expectedLastRun)){
      const timeWindowBefore = estCompletion - POLL_LENGTH;
      const timeWindowAfter = estCompletion;
      if(now >= timeWindowBefore && now <= timeWindowAfter){
        session.publish('io.outlawdesigns.cron.executionMissed',[jobsArr[i]]);
        console.log('published: io.outlawdesigns.cron.executionMissed');
      }
    }
  }
}
function _getTimeoutDelay(avgExecutionTime){
  return Math.round(avgExecutionTime) > 10 ? Math.round(avgExecutionTime) * 1000:10000;
}

let jobs = [];

wampConn.onopen = async (session)=>{
  console.log('Connected to WAMP router...');
  jobs = await _getJobList();
  console.log(`Retrieved ${jobs.length} jobs...`);
  await mysqlEvents.start();
  console.log('Monitoring DB...');
  setInterval( async()=>{
    // console.log('Updating Job list...');
    const updatedJobs = await _getJobList();
    if(updatedJobs.length !== jobs.length){
      jobs = updatedJobs;
      console.log(`Job list changed. New Length: ${jobs.length}`);
    }
    _checkForOverdue(jobs, session);
  },POLL_LENGTH);
}
//wrapping in a timeout because we're busting token's nbf
setTimeout(()=>{
  wampConn.open();
},2000);

//loop testing with no wampconn
/*
(async ()=>{
  jobs = await _getJobList();
  setInterval(()=>{
    _checkForOverdue(jobs, null);
  },POLL_LENGTH);
})();*/
