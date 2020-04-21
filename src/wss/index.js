import fs from 'fs'
import os from 'os'
import { mnemonicGenerate, blake2AsHex } from '@polkadot/util-crypto'
import Keyring from '@polkadot/keyring'
import {
  stringToHex, numberToHex, isHex, u8aToHex
} from '@polkadot/util'
import {
  didToHex, NonceManager, getIPAdress
} from 'libs/util'
import { checkAuth } from 'libs/auth'
import logger from 'libs/log'
import errors from 'libs/errors'

const homedir = os.homedir()
const handleResult = (events, status, socket, payload, api) => {
  logger.info('Transaction status:', status.toString())
  if (status.type === 'Future' || status.type === 'Invalid') {
    process.exit(0)
  }
  if (status.isInBlock) {
    let txStatus = true
    let errorMsg = 'sign error, please check your params'
    events.forEach(({ phase, event: { data, section, method } }) => {
      const dataStr = data.toString()
      logger.info(
        '\t',
        phase.toString(),
        `: ${section}.${method}`,
        dataStr
      )
      if (method.includes('ExtrinsicFailed')) {
        const [metaError] = JSON.parse(dataStr)
        if (metaError.Module) {
          const { index, error } = metaError.Module
          const { name } = api.findError(new Uint8Array([index, error]))
          errorMsg = errors[name]
        }
        txStatus = false
      }
    })

    if (txStatus) {
      const { event: { data, method } } = events.filter(({ event }) => event.section === 'did').pop()
      socket.emit(method, {
        status,
        msg: data.toString(),
        payload
      })
    } else {
      socket.emit('tx_failed', {
        status,
        msg: errorMsg,
        payload
      })
    }
  } else if (status.isFinalized) {
    logger.info('Finalized block hash', status.asFinalized.toHex())
  }
}

const handleError = (error, msg, socket, isRestart = true) => {
  logger.error(error, msg)
  socket.emit('tx_failed', {
    msg
  })
  if (isRestart) process.exit(0)
}

const getSigner = () => new Promise((resolve, reject) => {
  fs.readFile(
    `${homedir}/.substrate/5EhdfzDGWguro2dxQcQs9Wssvhpq4JSA3HsuGMvDPgHSYwqV`,
    async (err, res) => {
      if (err) {
        reject(err)
      } else {
        const keyring = new Keyring({ type: 'sr25519' })

        const seed = res.toString().replace(/[\r\n]/g, '')
        const pair = keyring.addFromMnemonic(seed)

        resolve(pair)
      }
    }
  )
})

export default async function prochainWsServer(api, socket) {
  const signer = await getSigner()
  // nonce manager
  const nonceManager = new NonceManager(api)

  socket.on('create_by_sns', async payload => {
    try {
      const { unionid, type, shortIndex } = payload
      logger.info(unionid, type, shortIndex, 'creation params')
      // social accounnt
      // const hashedSid = blake2AsHex(unionid, 256)
      // const hashedSid2 = blake2AsHex(`${hashedSid}1`, 256)

      // social superior
      // const hashedSocial = blake2AsHex(superior, 256)
      // const didHash = await api.query.did.socialAccount(hashedSid2)
      // if (!didHash.isEmpty) {
      //   socket.emit('Created', {
      //     status: { exists: true },
      //     payload
      //   })
      //   return logger.info('账号已存在')
      // }

      // find superior by short index
      const indexHash = blake2AsHex(shortIndex, 256)
      const superiorUserKey = await api.query.did.userKeys(indexHash)
      if (superiorUserKey.isEmpty) {
        handleError('', '上级DID不存在', socket, false)
        return false
      }

      const mnemonicPhrase = mnemonicGenerate()
      const keyring = new Keyring({ type: 'sr25519' })
      const { address, publicKey } = keyring.addFromMnemonic(mnemonicPhrase)

      // save keystore
      const pairKeystore = JSON.stringify(
        keyring.toJson(address, address.substr(0, 6)),
        null,
        2
      )

      // save mnemonic phrase
      const pairSeed = JSON.stringify({
        address,
        seed: mnemonicPhrase
      })

      const nonce = await nonceManager.getNonce(signer.address)
      const pubkey = u8aToHex(publicKey)
      const didType = stringToHex(type)
      const socialHash = stringToHex(blake2AsHex(unionid, 256))

      api.tx.did
        .create(pubkey, address, didType, superiorUserKey, socialHash, null)
        .signAndSend(signer, { nonce },
          ({ events = [], status }) => {
            handleResult(events, status, socket, payload, api)
          })
        .catch(error => {
          handleError(error, 'internal error', socket)
        })

      fs.writeFile(
        `${homedir}/.substrate/wallet/key_stores/${address}.json`,
        pairKeystore,
        err => {
          if (err) return logger.error(err)
          logger.info('create key pair successfully')
          return true
        }
      )

      fs.writeFile(
        `${homedir}/.substrate/wallet/keys/${address}.json`,
        pairSeed,
        err => {
          if (err) return logger.error(err)
          logger.info('save pair seed successfully')
          return true
        }
      )
    } catch (error) {
      handleError(error, '创建DID失败，请重试', socket, false)
    }
    return null
  })

  socket.on('create_by_old', async payload => {
    try {
      /* eslint-disable */
      let { pubkey, address, didType, superior, socialAccount, socialSuperior } = payload
      const nonce = await nonceManager.getNonce(signer.address)

      superior = isHex(superior) ?  superior : didToHex(superior)
      didType = stringToHex(didType)
      socialAccount = socialAccount ? stringToHex(blake2AsHex(socialAccount, 256)) : null
      socialSuperior = socialSuperior ? stringToHex(blake2AsHex(socialSuperior, 256)) : null
      logger.info(pubkey, address, didType, superior, socialAccount, socialSuperior, 'input data----')
      api.tx.did
        .create(pubkey, address, didType, superior, socialAccount, socialSuperior)
        .signAndSend(signer, { nonce },
          ({ events = [], status }) => {
            handleResult(events, status, socket, payload, api)
          })
        .catch(error => {
          handleError(error, 'internal error', socket)
        })
    } catch (error) {
      handleError(error, "创建DID失败，请重试", socket, false)
    }
	return null
  })

  socket.on('sign', async payload => {
    try {
      const { address, method, params, token } = payload

      // auth check
      const ipAdd = getIPAdress()
      if (ipAdd !== '172.21.0.3' && process.env.mode === 'production') {
        const rs = await checkAuth(token)
        if (!rs.success) {
          return handleError(rs.message, socket, false)
        }
      }

      const res = fs.readFileSync(`${homedir}/.substrate/wallet/keys/${address}.json`)
      const keyring = new Keyring({ type: 'sr25519' })

      const { seed } = JSON.parse(res.toString())
      const pair = keyring.addFromMnemonic(seed)

      const { nonce } = await api.query.system.account(address)

      /*  eslint no-plusplus: ["error", { "allowForLoopAfterthoughts": true }]  */
      for (let i = 0; i < params.length; i++) {
        const num = params[i]
        if (typeof num === 'number') {
          params[i] = numberToHex(num)
        }
      }

      logger.info(address, method, params, nonce - 0, 'sign params')
      api.tx.did[method](...params)
        .signAndSend(pair, { nonce },
          ({ events = [], status }) => {
            handleResult(events, status, socket, payload, api)
          }
        )
        .catch(error => {
          handleError(error, 'internal error', socket)
        })

    } catch (error) {
      handleError(error, "签名失败，请重试", socket, false)
    }
	return null
  })

  socket.on('test_transfer', async payload => {
    try {
      const { dest, num } = payload
      logger.info('test transfer', dest, num)
      const keyring = new Keyring({ type: 'sr25519' });
      const alice = keyring.addFromUri('//Alice')

      const amount = numberToHex(num * 10 ** 15)
      api.tx.balances.transfer(dest, amount).signAndSend(alice)

    } catch (error) {
      handleError(error, "签名失败，请重试", socket, false)
    }
	return null
  })
}
