import { didToHex, metadataFormat } from 'libs/util'

export default async (req, res, api) => {
  try {
    const { did } = req.params
    const userKey = didToHex(did)
    const metadata = await api.query.did.metadata(userKey)
    const result = metadataFormat(metadata.toJSON())

    // free balance
    const { data: balances } = await api.query.system.account(metadata.address)
    result.free_balance = balances.free.toString() / 10 ** 15

    // reserved balance
    result.reserved_balance = balances.reserved.toString() / 10 ** 15

    res.json({
      result: true,
      data: result
    })
  } catch (error) {
    console.log(error, 'get metadata error')
    res.json({
      result: false
    })
  }
}
