import { blake2AsHex } from '@polkadot/util-crypto'
import { hexToDid } from 'libs/util'

export default async (req, res, api) => {
  try {
    const { type, identifier } = req.query
    let didHash
    if (type === 'unionid') {
      const wxHash = blake2AsHex(identifier, 256)
      const hash = blake2AsHex(`${wxHash}1`, 256)
      didHash = await api.query.did.socialAccount(hash)
    } else if (type === 'index') {
      const hash = blake2AsHex(identifier, 256)
      didHash = await api.query.did.userKeys(hash)
    } else { // did hash
      didHash = identifier
    }

    const metadata = await api.query.did.metadata(didHash)
    const result = hexToDid(metadata.did.toString())

    res.json({
      result
    })
  } catch (error) {
    res.json({
      code: 0,
      msg: 'convertion failed',
      data: null
    })
  }
}
