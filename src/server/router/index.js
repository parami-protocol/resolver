import multipart from 'connect-multiparty'
import { Router } from 'express'

import didController from '../controller/did'
import convertionController from '../controller/convertion'

export default ({ config, api }) => {
  console.log(config)
  const router = Router()

  const multipartMiddleware = multipart()

  router.get('/did/:did', (req, res) => {
    didController(req, res, api)
  })

  router.get('/convertion', async (req, res) => {
    convertionController(req, res, api)
  })

  router.post('/test', multipartMiddleware, (req, res) => {
    res.json({
      success: true,
      message: 'test success'
    })
  })

  return router
}
