#Include picking up appconfig.adminDBHost, and port from UserData on Launch
#perhaps include primary and backup
/rxds/node/runner/instance.sh > instance.json
#Consider downloading script
/usr/local/bin/node /rxds/node/runner/run.js 
# Need to detect issues launching the node script above
