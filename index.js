import mysql from 'mysql2';
import autobahn from 'autobahn';
import ZongJi from '@vlasky/zongji';
import ModelFactory from '@outlawdesigns/cronmonitorsdk';
import authClient from '@outlawdesigns/authenticationclient';

import config from './config.js'

const BINLOG_EVENTS = {
  INSERT:'WriteRows',
  UPDATE:'UpdateRows',
  DELETE:'DeleteRows'
};

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

const zongji = new ZongJi(mysqlConn);

const zongOptions = {
    startAtEnd: true,
    serverId:MYSQL_APP_ID,
    excludeSchema: {
        mysql: true
    },
    includeEvents: ['tablemap', 'writerows', 'updaterows', 'deleterows'],
    includeSchema:{
      [process.env.MYSQL_CRON_DB]:true
    }
};

const wampConn = new autobahn.Connection({
  url: process.env.WAMPURL,
  realm: process.env.WAMPREALM,
  authmethods: ['ticket'],
  authid: process.env.AUTH_CLIENT_ID,
  onchallenge: function(session,method,extra){
    return authClient.getAccessToken();
  }
});

zongji.on('binlog', event => {
  const table = event.tableMap[event.tableId];
  if(!table){
    return;
  }
  const expression = `${table.parentSchema}.${table.tableName}`;
  const eventType = event.getTypeName();
  let selectedTriggers = triggers.filter(trigger => trigger.expression == expression && trigger.event === eventType);
  selectedTriggers.forEach(trigger => trigger.handler(event));
});

const triggers = [
  {
    expression:`${process.env.MYSQL_CRON_DB}.${ModelFactory.get('execution').table}`,
    event: BINLOG_EVENTS.INSERT,
    handler: event => _executionInsertHandler(event,wampConn)
  },
  {
    expression:`${process.env.MYSQL_CRON_DB}.${ModelFactory.get('job').table}`,
    event: BINLOG_EVENTS.INSERT,
    handler: event => _genericInsertHandler(event,wampConn,'jobCreated')
  },
  {
    expression:`${process.env.MYSQL_CRON_DB}.${ModelFactory.get('job').table}`,
    event: BINLOG_EVENTS.UPDATE,
    handler: event => _genericUpdateHandler(event,wampConn,'jobChanged')
  },
  {
    expression:`${process.env.MYSQL_CRON_DB}.${ModelFactory.get('job').table}`,
    event: BINLOG_EVENTS.DELETE,
    handler: event => _genericDeleteHandler(event,wampConn,'jobDeleted')
  },
  {
    expression:`${process.env.MYSQL_CRON_DB}.${ModelFactory.get('subscription').table}`,
    event: BINLOG_EVENTS.INSERT,
    handler: event => _genericInsertHandler(event,wampConn,'subscriptionCreated')
  },
  {
    expression:`${process.env.MYSQL_CRON_DB}.${ModelFactory.get('subscription').table}`,
    event: BINLOG_EVENTS.UPDATE,
    handler: event => _genericUpdateHandler(event,wampConn,'subscriptionChanged')
  },
  {
    expression:`${process.env.MYSQL_CRON_DB}.${ModelFactory.get('subscription').table}`,
    event: BINLOG_EVENTS.DELETE,
    handler: event => _genericDeleteHandler(event,wampConn,'subscriptionDeleted')
  },
];

function _executionInsertHandler(event, wampConn){
  let newRow = event.rows[0].after;
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
  let newRow = event.rows[0].after;
  if(wampConn.isOpen){
    let publishStr = `io.outlawdesigns.cron.${eventName}`;
    console.log(`published: ${publishStr}`);
    wampConn.session.publish(publishStr, [newRow]);
  }
}
function _genericUpdateHandler(event, wampConn, eventName){
  let before = event.rows[0].before;
  let after = event.rows[0].after;
  if(wampConn.isOpen){
    let publishStr = `io.outlawdesigns.cron.${eventName}`;
    console.log(`published: ${publishStr}`);
    wampConn.session.publish(publishStr, [before,after]);
  }
}
function _genericDeleteHandler(event, wampConn, eventName){
  let before = event.rows[0].before;
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
  //await mysqlEvents.start();
  zongji.start(zongOptions);
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
