import Express from 'express'
import http from 'http'
import sock from 'socket.io'
import cors from 'cors'
import bodyParser from 'body-parser'
import cookieParser from 'cookie-parser'
import session from 'express-session'
import { createApi, reload } from 'libs/util'
import router from './server/router'
import config from './config'
import wsServer from './wss'
import eventHandler from './wss/event'
import kafkaConsumer from './kafka'

const app = Express()
const server = http.Server(app)

const balancesListeners = []

// 全局变量
global.nonceMap = {}
global.hashName = {}

const entry = async () => {
  const api = await createApi()
  const io = sock(server)

  io.on('connection', async socket => {
    // ws server
    wsServer(api, socket)

    // listeners
    socket.on('setName', msg => {
      const { name, address } = msg
      console.log(name, 'client name')
      global.hashName[name] = socket.id

      if (!balancesListeners.includes(address)) {
        balancesListeners.push(address)
        api.query.system.account(address, ({ data: { free: current } }) => {
          console.log(
            current.toString(),
            'balance change---------------------'
          )
          const curSocketId = global.hashName[name]
          const toSocket = io.sockets.connected[curSocketId]
          if (toSocket) {
            toSocket.emit('balance_change', {
              balance: current.toString() / 10 ** 15
            })
          }
        })
      }
    })
  })

  // events listener
  eventHandler(api, io)

  // kafka consumer
  kafkaConsumer(api)

  app.use(cookieParser())

  app.use(
    session({
      secret: 'prochain',
      resave: false,
      saveUninitialized: true,
      cookie: { secure: true }
    })
  )

  app.use(
    cors({
      exposedHeaders: config.corsHeaders,
      credentials: true
    })
  )

  app.use(
    bodyParser.json({
      limit: config.bodyLimit
    })
  )

  app.use(
    bodyParser.urlencoded({
      extended: false
    })
  )

  app.use('/api/v1', router({ config, api }))

  app.get('/', (req, res) => {
    res.sendFile(`${process.cwd()}/public/index.html`)
  })

  app.get('/reg', (req, res) => {
    res.sendFile(`${process.cwd()}/public/reg.html`)
  })

  server.listen(process.env.PORT, () => {
    console.log(`listening on *:${process.env.PORT}`)
  })
}

entry().catch(console.log)

process.on('exit', () => {
  console.log('restart server---------------')
  reload()
})
