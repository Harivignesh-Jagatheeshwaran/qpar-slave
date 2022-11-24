"use strict";
const appconfig = require('./appconfig_k8');
const wsq = require("./wsq");
const  fs = require('fs');
const proc =  require('child_process');
const spawn = proc.spawn;
const exec = proc.exec;
const os = require('os');
// appconfig.MR="/usr/local/MATLAB/MATLAB_Runtime/";
var prevCpus = os.cpus();
var prevProc=[];
var procTime=60000;
var spotExitCheckFreq=10000;

global.gInstance={}
global.slaves={}


process.on('unhandledRejection', error => {
  console.log('here1');
  console.log('unhandledRejection', error.message);
  console.log(error);
  poweroff();
});
process.on('uncaughtException', error => {
  console.log('here2');
  console.log('unhandledRejection', error.message);
  console.log(error);
  poweroff();
});

function shutdown(p_immediate){
  if (p_immediate) {exec("sudo poweroff;");} else {exec("(sleep 300;sudo poweroff)");}
}
function poweroff(p_immediate) {
      if (  (appconfig.instance.run_by_cron == "1") && (appconfig.instance.user_data !== " ")) {
           console.log('Trying to power off');
           shutdown(p_immediate);
      }
      else {
        console.log("Not powering off in interactive mode");
        process.exit();
      }
}
global.poweroff = poweroff;
function sleep(ms){
    return new Promise(resolve=>{
        setTimeout(resolve,ms)
    })
}

function wait () {
   if (!global.exit)
        setTimeout(wait, 10000);
};
wait();
//Look into reconnect logic in case of network failure and timeout
global.connect_admin = function() {
    var p = new Promise((resolve,reject) => {
      wsq.connect({host: appconfig.adminDBHost, port: appconfig.adminDBPort, 
               user:appconfig.adminDBUser, password: appconfig.adminDBPass}, function(err, con) {
        if (err) reject(err);
         global.gInstance.adminDBCon=con;
         if (con) {resolve(con); 
		 //console.log(" >>>> showing con : ", con)
		 }
      });
    });
//	console.log(" >>>> showing p : ",p);
    return p;
};

//Look into reconnect logic in case of network failure and timeout
global.connect_log = function() {
    var p = new Promise((resolve,reject) => {
      wsq.connect({host: appconfig.adminLogHost, port: appconfig.adminLogPort, 
               user:appconfig.adminDBUser, password: appconfig.adminDBPass}, function(err, con) {
        if (err) reject(err);
         global.gInstance.adminLogCon=con;
         con.on("close",
             function() {
               setTimeout(start_up,10000);
             });
        if (con) {resolve(con);}
      });
    });
    return p;
};

async function listener() {
    appconfig.instance=JSON.parse(fs.readFileSync(appconfig.instance_file, 'utf8'));
    
//    if (  (appconfig.instance.run_by_cron == "1") && (appconfig.instance.user_data == " ")) {
//       console.log("Running from cron without any user data");
//       return;
//    }
    
//    if (appconfig.instance.user_data !== " ") {
//      appconfig.adminDBHost = appconfig.instance.user_data.adminDBHost;
//      appconfig.adminDBPort = appconfig.instance.user_data.adminDBPort;
//      appconfig.adminDBUser = appconfig.instance.user_data.adminDBUser;
//      appconfig.adminDBPass = appconfig.instance.user_data.adminDBPass;
//    }  
    await global.connect_admin();
    console.log("connected to admin-db via ipc");
//         appconfig.instance =  {"ami_id":"0483949c5318","instance_id":"0483949c5318","instance_type":"container","local_hostname":"172.17.0.3","ami_launch_index":"0","user_data":" ","local_ip":"172.17.0.3", "run_by_cron":"0"};
//	let json_data =JSON.parse (appconfig.instance);
 	
	 let reqJSON  = Object.assign({}, appconfig.instance);
         reqJSON.x_fn="init_node";
//         console.log(' <<<<< req_json >>>>', appconfig.instance);         
	let data  = await global.gInstance.adminDBCon.rxds_exec(reqJSON);
  //       console.log(' <<<<<<<  init_node >>>>>>',data);        
	 if (data.qerr) {return;};
	 global.node_id = data.node_id;
	 global.max_slaves = data.max_slaves;
	 global.qlog_port = data.qlog_port;
	 global.qpar_port = data.qpar_port;
	 //Get  the new admin handles
   appconfig.adminDBPort = global.qpar_port;
   global.gInstance.adminDBCon.close();
   await global.connect_admin();
   console.log("connected to admin-db slave via ipc");
	 
	 appconfig.adminLogHost = appconfig.adminDBHost;
	 appconfig.adminLogPort = data.qlog_port;
	 
   global.slave_count = 0;
   await global.connect_log();
   console.log("connected to log-db via ipc");
  
   //console.log('registered node %o', global.node_id);
    while (1) {
      reqJSON = { x_fn: "process_listen",node_id:global.node_id};

      data = await global.gInstance.adminDBCon.rxds_exec(reqJSON);
 //console.log('while loop entering >>>>> ',data);
      //Handle instance shut-down here 
      if (data.qerr) {console.log('>>>>>>>> data.qerr : ',data); return;};
      if (data.slave) {
//console.log('data--------',data)
//console.log('data.slave-------',data.slave)
//console.log('global.slave-------',global)
//console.log('data.slave.version-----',data.slave.version)
//console.log('globa----------------',!global.slaves[data.slave.slave_type+"-"+data.slave.version])
       if (!global.slaves[data.slave.slave_type+"-"+data.slave.version]) {download_exe(data.slave);}//Check if the slave exe already downloaded;
        spawn_proc(data.slave);
      }
      else if (data.quit) {
        break;
      }
      else if (data.kill) {
        console.log('asked to kill task')
        break;
      }
      else if (data.shutdown) {
        console.log('asked to shutdown node');
        var reqJSON1 = { x_fn        : "slave_log",slave_id:0,node_id:global.node_id};
        reqJSON1.pipe='scheduler';reqJSON1.data="Shutting down the node";
        await global.gInstance.adminDBCon.rxds_exec(reqJSON1);

        poweroff(true);
        break;
      }
      //await sleep(5000);

      //break;
    } // infinite loop
} // listener

function download_exe(s) {
  console.log("downloading slave exe");
  console.log(s);
  var reqJSON = { x_fn        : "slave_log",slave_id:s.slave_id,node_id:global.node_id};
  reqJSON.pipe='scheduler';reqJSON.data="Downloading slave exe: " + s.exec_path;
  global.gInstance.adminDBCon.rxds_exec(reqJSON);
  var path_split=s.exec_path.split(/\//);
  var file_name=path_split[path_split.length-1];
  const download=appconfig.exec_path+"repo/"+file_name;
  proc.execSync("mkdir -p "+appconfig.exec_path+"repo");

  var curl_out = proc.execSync("curl -s "+s.exec_path+">"+download);
  reqJSON.pipe='scheduler';reqJSON.data="Downloaded slave exe: " + s.exec_path;
  global.gInstance.adminDBCon.rxds_exec(reqJSON);
  global.slaves[s.slave_type+"-"+s.version]={download:download,file_name:file_name};
  if (s.runtime.match(/julia/)) {
     proc.execSync("touch /rxds/julia/Q/src/qpar.jl"); /* Touch to trigger recompilation */
  }

} //download_exe

function spawn_proc(s) {
       //Spawn task to run EXE
  const d=global.slaves[s.slave_type+"-"+s.version]
  const download=d.download;
  const slave_dir=appconfig.exec_path+s.slave_id;
  var exe,args;
	console.log(s);
	console.log(download);
	console.log( ['"'+s.master_ip+'"', s.master_port, '"'+s.slave_type+'"', s.slave_id]);
	console.log(appconfig.exec_path);
  var reqJSON = { x_fn        : "slave_log",slave_id:s.slave_id,node_id:global.node_id,task_id:0};
  
  /* Copy over to folder for slave  process */
  proc.execSync("mkdir -p "+slave_dir);
  proc.execSync("cp "+download+ " " + slave_dir);
  if (d.file_name.match(/.gz$/)) {
    proc.execSync("(cd "+ slave_dir +"; tar xvfz "+ d.file_name +")");
  }
  
  proc.execSync("chmod +x "+slave_dir+ "/*");
  
  if (global.slave_count >= global.max_slaves) {
    reqJSON.pipe='scheduler';reqJSON.data="Cannot launching slave - reached max " + s.slave_type;
    global.gInstance.adminDBCon.rxds_exec(reqJSON);
    console.log(reqJSON.data);
    return -1;
  }
  else {
    global.slave_count++;
    reqJSON.pipe='scheduler';reqJSON.data="Launching slave " + s.slave_type;
    global.gInstance.adminDBCon.rxds_exec(reqJSON);
    console.log(reqJSON.data);
  }
  
  var child, senv=appconfig.env;
  senv=appconfig.get_env(s.runtime,slave_dir);
  exe=appconfig.get_exe(s, slave_dir);
  args=appconfig.get_args(s, appconfig);
	console.log(exe);
	console.log(senv);
  child = spawn(exe,args,{cwd:slave_dir,env:senv,shell:true});

  global.children.push(child);
  child.PID=0;child.task_id=0;
  child.slave_id=s.slave_id;
      
child.stdout.on('data', function(data) {
    reqJSON.pipe='stdout';reqJSON.data=data.toString().slice(0, -1).replace(/\n/g,"\\n");
    console.log('stdout: ' + data);
    const m=reqJSON.data.match(/starting task\s*([0-9]*)\s*([^ ]*)/);
    if (m && m.length > 1) {
      child.task_id=Number(m[1]);reqJSON.task_id=Number(m[1]);
    }
    if (child.PID===0) {
      const m=reqJSON.data.match(/Slave PID: ([^ ]*)/);
      if (m && m[1]) {child.PID=m[1];console.log('Slave PID:'+m[1]);} 
    }
    global.gInstance.adminLogCon.rxds_exec(reqJSON);
});
child.stderr.on('data', function(data) {
    reqJSON.pipe='stderr';reqJSON.data=data.toString().slice(0, -1).replace(/\n/g,"\\n");
    global.gInstance.adminLogCon.rxds_exec(reqJSON);
    console.log('stdout: ' + data);
});
child.on('close', function(code) {
    reqJSON.pipe='close';reqJSON.data='closing code: ' + code;
    global.gInstance.adminLogCon.rxds_exec(reqJSON);
    console.log('closing code: ' + code);
});

child.on('exit', function (code, signal) {
  reqJSON.pipe='exit';reqJSON.data='child process exited with ' +
              `code ${code} and signal ${signal}`;
  global.slave_count--;            
  global.gInstance.adminLogCon.rxds_exec(reqJSON);
  var reqJSON2 = { x_fn        : "slave_exit",slave_id:s.slave_id,node_id:global.node_id};
  global.gInstance.adminDBCon.rxds_exec(reqJSON2);

  console.log('child process exited with ' +
              `code ${code} and signal ${signal}`);
  child.PID=0;              
});

child.on('error', function (e) {
    reqJSON.pipe='error';reqJSON.data=e;
    global.gInstance.adminLogCon.rxds_exec(reqJSON);
  console.log('child process errored'); console.log(e); 
  child.PID=0;
});


} // spawn_proc	

function start_up() {
  global.children=[];
  listener()
    .then(v=>{console.log("complete");process.exit();})
    .catch(v=>{
       console.log("Unable to connect to master");
       console.log(v);
       console.log("error %o %o",this, v);
       poweroff(false);
    });
}

function cpu_usage() {
  //check_spot_termination();
  const currCpus = os.cpus()
  var deltas = {total:0,user:0,nice:0,sys:0,idle:0,irq:0};
  var metrics={load:0,idle_cores:0,loaded_cores:0};
  for (var i=0,len=currCpus.length;i<len;i++) {
    var prevCpu = prevCpus[i];
    var currCpu = currCpus[i];
    var cpu_delta={total:0};
    for (var t in prevCpu.times) {
      deltas.total += currCpu.times[t] - prevCpu.times[t];
      cpu_delta.total += currCpu.times[t] - prevCpu.times[t];
    }
    for (var t in prevCpu.times) {
      deltas[t] += currCpu.times[t] - prevCpu.times[t];
      cpu_delta[t] = currCpu.times[t] - prevCpu.times[t];
    }
    if(cpu_delta.idle/cpu_delta.total>0.9) metrics.idle_cores++;
    if(cpu_delta.idle/cpu_delta.total<0.1) metrics.loaded_cores++;
  }

  metrics.totalmem = os.totalmem();
  metrics.freemem = os.freemem();
  metrics.freemempct = Math.round(metrics.freemem*100/metrics.totalmem);
  metrics.load=(100 - Math.round(100 * deltas.idle / deltas.total));
  prevCpus = currCpus;
  const reqJSON = { x_fn        : "node_stats",node_id:global.node_id,metrics:metrics};
  const p = global.gInstance.adminDBCon.rxds_exec(reqJSON);
  p.then();
  proc_usage();
} //cpu_usage

function check_spot_termination() {
  const comm=proc.execSync("/rxds/node/runner/spot.sh");
  const resp=comm.toString();
  //const comm=proc.execSync("curl -s http://169.254.169.254/latest/meta-data/instance-action");
  //const resp=JSON.parse(comm);
//{"action": "terminate", "time": "2017-09-18T08:22:00Z"}	
//  if (comm.toString().match(/....-..-..T..:..:..Z/)) {
    //if (resp.action == "terminate"){
    if (!resp.match("not_terminated")) {
    console.log("spot marked for termination");
    const reqJSON = { x_fn        : "node_spot_terminate",node_id:global.node_id};
    const p = global.gInstance.adminDBCon.rxds_exec(reqJSON);
    p.then(v=>{process.exit();});
  }
} //check_spot_termination

function child_stats(child) {
  var data, datam;
  var metrics={};
  var pid=child.PID;
  if (pid===0) return;
  try {
      data=fs.readFileSync("/proc/" + pid + "/stat");
      datam=fs.readFileSync("/proc/" + pid + "/statm");
  } catch (err) {
    if (err.code === 'ENOENT') { // Process has died
       console.log('Process has exited!');
       child.PID=0;
       const reqJSON2 = { x_fn        : "slave_exit",slave_id:child.slave_id,node_id:global.node_id};
       global.gInstance.adminDBCon.rxds_exec(reqJSON2);
       return;  
    } else {
       throw err;
    }
  }    
  const elems = data.toString().split(' ');
  const elemsm = datam.toString().split(' ');
  const utime = parseInt(elems[13]);
  const stime = parseInt(elems[14]);
  if(prevProc[pid]) {
    metrics.proc = parseInt(elems[38]);
    metrics.vsize = parseInt(elems[22]);
    metrics.threads = parseInt(elems[19]);
    const delta = utime + stime - prevProc[pid];
    metrics.cpu = 100 * (delta / procTime*10);
    metrics.memory = 4096 * elemsm[1];
    console.log(metrics);
    prevProc[pid]= utime + stime;
    const reqJSON = { x_fn        : "slave_stats",node_id:global.node_id,
              slave_id:child.slave_id,metrics:metrics};
    const p = global.gInstance.adminDBCon.rxds_exec(reqJSON);
    p.then(); 
  } else {
    prevProc[pid]= utime + stime;
  }
} //child_stats

function proc_usage() {
  global.children.forEach(v=>{child_stats(v)});
} //proc_usage

//Collect CPU stats every minute
//setInterval(cpu_usage,procTime);
//Check for Spot exit every 10s
//setInterval(check_spot_termination,spotExitCheckFreq);

start_up();
