FROM node:11.9.0-slim

#RUN apt upgrade -y && apt update -y

RUN apt-get update && apt-get install apt-utils -y && apt-get install vim -y && apt-get install libcurl3 -y && \
    mkdir -p /usr/local/MATLAB/MATLAB_Runtime/ 

COPY v95 /usr/local/MATLAB/MATLAB_Runtime/v95

#COPY x86_64-linux-gnu /usr/lib/x86_64-linux-gnu


WORKDIR /rxds/node/runner

COPY ["entrypoint.sh" ,"appconfig_master.js","appconfig_tesla.js","appconfig.js","instance.sh","instance_new.sh","node_modules","package-lock.json", "spot.sh", "typed.js", "appconfig_k8.js", "assert.js", "instance.json", "libc.js", "package.json", "run_k8.js", "t.js", "wsq.js", "./"]

RUN npm install && apt-get remove --auto-remove libcurl4-openssl-dev -y && apt-get install libcurl3 -y && \
    apt install libxtst6 libxt6 -y && \
    ln -s /usr/local/lib/R/lib/libR.so /lib/x86_64-linux-gnu/libR.so


#CMD ["node", "run_k8.js"]

ENTRYPOINT ["sh","/rxds/node/runner/entrypoint.sh"]

