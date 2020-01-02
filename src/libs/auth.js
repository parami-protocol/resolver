import rp from 'request-promise'

const HOST = process.env.HTTP_HOST
const apiAuth = `${HOST}/api/v1/mainnet/auth`

/*  eslint-disable */
export async function checkAuth() {
  return rp({
    method: 'GET',
    uri: apiAuth,
    json: true
  })
}
