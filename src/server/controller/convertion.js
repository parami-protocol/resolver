import { blake2AsHex } from '@polkadot/util-crypto'
const { hexToU8a, stringToU8a, u8aConcat } = require('@polkadot/util')
import { hexToDid } from 'libs/util'

export default async (req, res, api) => {
  try {
    const { type, identifier } = req.query
    let didHash, rawHash
    if (type === 'unionid') {
      rawHash = blake2AsHex(identifier, 256)
      const accountHash = blake2AsHex(`${rawHash}1`, 256)
      didHash = await api.query.did.socialAccount(accountHash)
    } else if (type === 'index') {
      rawHash = blake2AsHex(identifier, 256)
      didHash = await api.query.did.userKeys(rawHash)
    } else { // did hash
      didHash = identifier
    }
    let metadata = await api.query.did.metadata(didHash)
    if (metadata.isEmpty) {
      const np = u8aConcat(hexToU8a(rawHash), stringToU8a('1'))
      const finalParam = blake2AsHex(np, 256)
      console.log(rawHash, finalParam, 'query again-----')
      metadata = await api.query.did.metadata(finalParam)
    }
    const result = hexToDid(metadata.did.toString())

    res.json({
      result
    })
  } catch (error) {
    console.log(error)
    res.json({
      code: 0,
      msg: 'convertion failed',
      data: null
    })
  }
}
