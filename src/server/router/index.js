import multipart from 'connect-multiparty'
import { Router } from 'express'

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
    res.json({
      code: 200,
      message: 'callback get msg'
    })
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
