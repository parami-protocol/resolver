import multipart from 'connect-multiparty'
import { Router } from 'express'
import WXBizMsgCrypt from 'wxcrypt'

import ConvertionController from '../controller/convertion'
import MetadataController from '../controller/metadata'
import RandomController from '../controller/randomNumber'

export default ({ config, api }) => {
  console.log(config)
  const router = Router()

  const multipartMiddleware = multipart()

  router.get('/getStatus', (req, res) => {
    console.log('get status')
    res.json({
      code: 200,
      msg: 'success',
      data: null
    })
  })

  router.get('/did/:did', (req, res) => MetadataController(req, res, api))

  router.get('/convert', async (req, res) => ConvertionController(req, res, api))

  router.get('/random_number_hash', RandomController)

  router.get('/callback', (req, res) => {
    console.log(req.query, 'callback req msg')
    const {
      msg_signature: msgSignature, timestamp, nonce, echostr
    } = req.query
    const crypto = new WXBizMsgCrypt('qU5i7AKqcK', 'QonojiIYs9LMSlxa2fXvUdFNTDrNLRCsQNA97lPTj2n', 'wwac5056805667fcd9')
    const result = crypto.verifyURL(msgSignature, timestamp, nonce, echostr)
    res.send(result)
  })

  router.post('/callback', multipartMiddleware, (req, res) => {
    console.log(req.body, 'callback body msg')
    res.json({
      code: 200,
      message: 'callback post msg'
    })
  })

  return router
}
