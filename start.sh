HOST=http://140.143.223.100:8091/api/reload
git pull
npm run build
PORT=8091 npm run serve
info=`curl $HOST -X POST -d '{"restart": true}' --header "Content-Type: application/json"`
echo $info