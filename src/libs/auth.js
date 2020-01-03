import rp from 'request-promise'

const HOST = process.env.HTTP_HOST
const apiAuth = `${HOST}/api/v1/mainnet/auth_check`

/*  eslint-disable */
export async function checkAuth(token) {
  return rp({
    method: 'GET',
    uri: apiAuth,
    headers: {
      Authorization:  `Bearer ${token}`
    },
    json: true
  })
}
