#! /bin/bash/

cont_id=$(hostname)
cont_ip=$(hostname -i)

sed -i -e "s/container_id/$cont_id/g" instance.json

sed -i -e "s/container_ip/$cont_ip/g" instance.json

node /rxds/node/runner/run_k8.js
 
