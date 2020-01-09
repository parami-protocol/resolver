import multipart from 'connect-multiparty'
import { Router } from 'express'

import ConvertionController from '../controller/convertion'
import MetadataController from '../controller/metadata'

export default ({ config, api }) => {
  console.log(config)
  const router = Router()

  const multipartMiddleware = multipart()

  router.get('/did/:did', (req, res) => MetadataController(req, res, api))

  router.get('/convert', async (req, res) => ConvertionController(req, res, api))

  router.post('/test', multipartMiddleware, (req, res) => {
    res.json({
      success: true,
      message: 'test success'
    })
  })

  return router
}
