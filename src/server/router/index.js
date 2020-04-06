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

  router.post('/test', multipartMiddleware, (req, res) => {
    res.json({
      success: true,
      message: 'test success'
    })
  })

  return router
}
