HOST=http://140.143.223.100:8091/api/reload
LOG_NAME="./sign.log"
git pull
npm run build
#PORT=8091 npm run serve
PORT=8091 npm run serve >> $LOG_NAME 2>&1 &  #将调试信息写入文件，并以后台的方式运行
info=`curl $HOST -X POST -d '{"restart": true}' --header "Content-Type: application/json"`
echo $info