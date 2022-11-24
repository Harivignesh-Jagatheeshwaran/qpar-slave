var appconfig = {};

appconfig.adminDBHost   = 'tesla.rxdatascience.com';
appconfig.adminDBPort   = 5055;
appconfig.adminDBUser   = 'matlab';
appconfig.adminDBPass   = 'Matlab2019';
appconfig.instance_file="/rxds/node/runner/instance.json";
appconfig.exec_path= "/rxds/matlab/";
const MR="/usr/local/MATLAB/MATLAB_Runtime/";
const DYPATH=`${MR}/v95/runtime/glnxa64:${MR}/v95/sys/os/glnxa64:${MR}/v95/bin/glnxa64`;
const LD=`/usr/lib/x86_64-linux-gnu/:${DYPATH}`;
appconfig.env={"DYLD_LIBRARY_PATH":DYPATH,
               "LD_LIBRARY_PATH":LD}

//Export the Module
module.exports = appconfig;

