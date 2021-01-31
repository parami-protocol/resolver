const crypto = require('crypto')

const calculateRandomNumberHash = (randomNumber, timestamp) => {
  console.log('randomNumber ', randomNumber)
  console.log('timestamp ', timestamp.toString())

  const timestampHexStr = timestamp.toString(16)
  let timestampHexStrFormat = timestampHexStr

  // timestampHexStrFormat should be the hex string of a 32-length byte array.
  // Fill 0 if the timestampHexStr length is less than 64
  for (let i = 0; i < 16 - timestampHexStr.length; i++) {
    timestampHexStrFormat = `0${timestampHexStrFormat}`
  }

  const timestampBytes = Buffer.from(timestampHexStrFormat, 'hex')
  const newBuffer = Buffer.concat([Buffer.from(randomNumber.substring(2, 66), 'hex'), timestampBytes])
  const hash = crypto.createHash('sha256')
  hash.update(newBuffer)
  return `0x${hash.digest('hex')}`
}

const calculateSwapID = (randomNumberHash, receiver) => {
  console.log('receiver ', receiver.toString())

  const newBuffer = Buffer.concat([Buffer.from(randomNumberHash.substring(2, 66), 'hex'), Buffer.from(receiver)])
  const hash = crypto.createHash('sha256')
  hash.update(newBuffer)
  return `0x${hash.digest('hex')}`
}

export default async (req, res) => {
  const { randomNumber, receiver, amount } = req.query
  console.log('amount ', amount)

  const timestamp = Math.floor(Date.now() / 1000)

  const randomNumberHash = calculateRandomNumberHash(randomNumber, timestamp)
  console.log('randomNumberHash ', randomNumberHash.toString('hex'))

  const swapID = calculateSwapID(randomNumberHash, receiver)
  console.log('swapID ', swapID.toString('hex'))

  const data = { timestamp, swapID, randomNumberHash }

  res.json({ data, message: 'success', code: 0 })
}
