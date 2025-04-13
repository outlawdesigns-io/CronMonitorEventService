const mysql = require('mysql');
const autobahn = require('autobahn');
const MySQLEvents = require('@rodrigogs/mysql-events');
const ModelFactory = require('@outlawdesigns/cronmonitorsdk');

const config = require('./config');

const POLL_LENGTH = config.POLL_LENGTH;
const MYSQL_APP_ID = config.MYSQL_APP_ID;
// const POLL_BUFFER = 500;

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

const wampConn = new autobahn.Connection({
  url:process.env.WAMPURL,
  realm:process.env.WAMPREALM
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
  onEvent: (event)=> _jobInsertHandler(event,wampConn)
});
//Job Updated
mysqlEvents.addTrigger({
  name:'UPDATEJOB_TRIGGER',
  expression:`${process.env.MYSQL_CRON_DB}.${ModelFactory.get('job').table}`,
  statement:MySQLEvents.STATEMENTS.UPDATE,
  onEvent: (event)=> _jobUpdateHandler(event,wampConn)
});
//Job Deleted
mysqlEvents.addTrigger({
  name:'DELETEJOB_TRIGGER',
  expression:`${process.env.MYSQL_CRON_DB}.${ModelFactory.get('job').table}`,
  statement:MySQLEvents.STATEMENTS.DELETE,
  onEvent: (event)=> _jobDeleteHandler(event,wampConn)
});
mysqlEvents.on(MySQLEvents.EVENTS.CONNECTION_ERROR, console.error);
mysqlEvents.on(MySQLEvents.EVENTS.ZONGJI_ERROR, console.error);


function _executionInsertHandler(event, wampConn){
  let newRow = event.affectedRows[0].after;
  let thisJob = jobs.filter(e => e.id == newRow.jobId);
  if(wampConn.isOpen){
    if(thisJob.length){
      wampConn.session.publish('io.outlawdesigns.cron.executionComplete',[thisJob[0],newRow]);
    }else{
      //an execution has been inserted for a disabled or unregisted job.
      wampConn.session.publish('io.outlawdesigns.cron.illegalExecution',[newRow]);
    }
  }else{
    console.error('WAMP connection is not open')
  }
}
function _jobInsertHandler(event,wampConn){
  let newRow = event.affectedRows[0].after;
  if(wampConn.isOpen){
    console.log('published: io.outlawdesigns.cron.jobCreated');
    wampConn.session.publish('io.outlawdesigns.cron.jobCreated', [newRow]);
  }
}
function _jobUpdateHandler(event,wampConn){
  let before = event.affectedRows[0].before;
  let after = event.affectedRows[0].after;
  if(wampConn.isOpen){
    console.log('published: io.outlawdesigns.cron.jobChanged');
    wampConn.session.publish('io.outlawdesigns.cron.jobChanged', [before,after]);
  }
}
function _jobDeleteHandler(event,wampConn){
  let before = event.affectedRows[0].before;
  if(wampConn.isOpen){
    console.log('published: io.outlawdesigns.cron.jobDeleted');
    wampConn.session.publish('io.outlawdesigns.cron.jobDeleted',[before]);
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
    let estCompletion = Date.parse(expectedLastRun) + _getTimeoutDelay(avgExecSec);
    if(Date.parse(lastExec.endTime) < Date.parse(expectedLastRun)){
      //const timeWindowBefore = estCompletion - POLL_LENGTH - POLL_BUFFER;
      //const timeWindowAfter = estCompletion + POLL_LENGTH + POLL_BUFFER;
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
wampConn.open();
//loop testing with no wampconn
/*
(async ()=>{
  jobs = await _getJobList();
  setInterval(()=>{
    _checkForOverdue(jobs, null);
  },POLL_LENGTH);
})();*/
