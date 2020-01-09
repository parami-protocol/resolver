import { didToHex, metadataFormat } from 'libs/util'

export default async (req, res, api) => {
  try {
    const { did } = req.params
    const userKey = didToHex(did)
    const metadata = await api.query.did.metadata(userKey)
    const result = metadataFormat(metadata.toJSON())

    // free balance
    const balances = await api.query.balances.freeBalance(metadata.address)
    result.free_balance = balances.toString() / 10 ** 15

    // reserved balance
    const revBalance = await api.query.balances.reservedBalance(metadata.address)
    result.reserved_balance = revBalance.toString() / 10 ** 15

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
