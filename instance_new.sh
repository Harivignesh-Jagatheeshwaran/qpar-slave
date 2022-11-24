#TOKEN=`curl -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600"` \
#&& curl -H "X-aws-ec2-metadata-token: $TOKEN" -v http://169.254.169.254/latest/meta-data/
TOKEN=`curl -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600"`
ami_id=`curl -H "X-aws-ec2-metadata-token: $TOKEN" -v http://169.254.169.254/latest/meta-data/ami-id`
instance_id=`curl -H "X-aws-ec2-metadata-token: $TOKEN" -v http://169.254.169.254/latest/meta-data/instance-id`
instance_type=`curl -H "X-aws-ec2-metadata-token: $TOKEN" -v http://169.254.169.254/latest/meta-data/instance-type`
local_hostname=`curl -H "X-aws-ec2-metadata-token: $TOKEN" -v http://169.254.169.254/latest/meta-data/local-hostname`
ami_launch_index=`curl -H "X-aws-ec2-metadata-token: $TOKEN" -v http://169.254.169.254/latest/meta-data/ami-launch-index`
no_user_data=`curl -H "X-aws-ec2-metadata-token: $TOKEN" -v http://169.254.169.254/latest/meta-data/user-data | grep '404 - Not Found' |  wc  -l `
local_ip=`hostname -I`
if [ $no_user_data -gt 0 ]
then
   user_data='" "'
else    
   user_data=`curl -H "X-aws-ec2-metadata-token: $TOKEN" -v http://169.254.169.254/latest/meta-data/user-data`
fi

cat <<EOF
{"ami_id":"$ami_id","instance_id":"$instance_id","instance_type":"$instance_type","local_hostname":"$local_hostname","ami_launch_index":"$ami_launch_index","user_data":$user_data,"local_ip":"$local_ip", "run_by_cron":"$RUN_BY_CRON"}
EOF
