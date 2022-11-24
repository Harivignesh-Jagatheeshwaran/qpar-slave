var appconfig = {};

appconfig.adminDBHost   = '10.0.1.34';
appconfig.adminDBPort   = 5000;
appconfig.adminDBUser   = 'matlab';
appconfig.adminDBPass   = 'Matlab2019';
appconfig.instance_file="/rxds/node/runner/instance.json";
appconfig.exec_path= "/rxds/slaves/";
const MR="/usr/local/MATLAB/MATLAB_Runtime";
appconfig.MR = '/usr/local/MATLAB/MATLAB_Runtime';
var DYPATH=`${MR}/v95/runtime/glnxa64:${MR}/v95/sys/os/glnxa64:${MR}/v95/bin/glnxa64`;
var LD=`/usr/lib/x86_64-linux-gnu/:${DYPATH}`;
appconfig.get_env = function (runtime,slave_dir) {
   var  rundir;
   if (typeof runtime == "undefined") {runtime = "2018b";}
   if (runtime.match(/julia/)) {
     appconfig.env={"JULIA_LOAD_PATH":slave_dir+":/rxds/julia/Q/src:", "HOME":"/home/rxds"};
   }
   else {
       switch (runtime) {
          case "2018b":
            rundir="v95"; break;
          case "2019a":
            rundir="v96"; break;
          case "2019b":
            rundir="v97"; break;
          case "2020a":
            rundir="v98"; break;
          default:
            rundir="v95";
      }
      DYPATH=`${MR}/${rundir}/runtime/glnxa64:${MR}/${rundir}/sys/os/glnxa64:${MR}/${rundir}/bin/glnxa64`;
      LD=`/usr/lib/x86_64-linux-gnu/:${DYPATH}`;
      appconfig.env={"DYLD_LIBRARY_PATH":DYPATH, "LD_LIBRARY_PATH":LD};
   }

  return appconfig.env;
} //get_env

appconfig.get_exe = function (s,slave_dir) {
   var  rundir;
   var exe=slave_dir+"/"+s.executable;

   if (typeof s.runtime == "undefined") {s.runtime = "2018b";}
   if (s.runtime.match(/julia/)) {
     return "/rxds/software/"+s.runtime+"/bin/julia";
   }
   else {
     return exe;
   }

} //get_exe


appconfig.get_args = function (s, appconfig) {
   var args=[];
  if (s.runtime.match(/julia/)) {
    args=["/rxds/julia/Q/src/launch_slave.jl", '"'+s.master_ip+'"', s.master_port, 
                   '"'+appconfig.adminDBUser+'"','"'+appconfig.adminDBPass+'"',
                   '"'+s.slave_type+'"', s.slave_id];
  } 
  else if (s.executable.match(/^run.*sh$/)) {//Running matlab shell pass runtime
     args=['"'+appconfig.MR+'"', '"'+s.master_ip+'"', s.master_port, 
                   '"'+appconfig.adminDBUser+'"','"'+appconfig.adminDBPass+'"',
                   '"'+s.slave_type+'"', s.slave_id];
  }
  else {
     args=['"'+s.master_ip+'"', s.master_port, 
                   '"'+appconfig.adminDBUser+'"','"'+appconfig.adminDBPass+'"',
                   '"'+s.slave_type+'"', s.slave_id];
  }
  return args;  

} //get_args


appconfig.env={"DYLD_LIBRARY_PATH":DYPATH, "LD_LIBRARY_PATH":LD};

//Export the Module
module.exports = appconfig;

