import fs from 'fs'
import os from 'os'
import { mnemonicGenerate, blake2AsHex } from '@polkadot/util-crypto'
import Keyring from '@polkadot/keyring'
import {
  stringToHex, numberToHex, isHex, u8aToHex
} from '@polkadot/util'
import { didToHex, NonceManager, getIPAdress } from 'libs/util'
import { checkAuth } from 'libs/auth'
import logger from 'libs/log'

const homedir = os.homedir()

const handleResult = (events, status, socket, payload) => {
  logger.info('Transaction status:', status.toString())
  if (status.isFinalized) {
    logger.info('Completed at block hash', status.asFinalized.toHex())
    logger.info('Events:')

    let txStatus = true
    events.forEach(({ phase, event: { data, section, method } }) => {
      logger.info(
        '\t',
        phase.toString(),
        `: ${section}.${method}`,
        data.toString()
      )
      if (method.includes('ExtrinsicFailed')) {
        txStatus = false
      }
    })

    const { event: { data, method } } = events[events.length - 2]
    if (txStatus) {
      socket.emit(method, {
        status,
        msg: data.toString(),
        payload
      })
    } else {
      socket.emit('tx_failed', {
        status,
        msg: 'sign error, please check your params',
        payload
      })
    }
  }
}

const handleError = (error, msg, socket, nonceManager, address) => {
  logger.error(error, msg)
  if (address) {
    nonceManager.sub(address)
  }
  socket.emit('tx_failed', {
    msg
  })
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
      const { sid, type, socialSuperior } = payload
      logger.info(sid, type, socialSuperior, 'sns params')
      // social accounnt
      const hashedSid = blake2AsHex(sid, 256)
      const hashedSid2 = blake2AsHex(`${hashedSid}1`, 256)

      // social superior
      const hashedSocial = blake2AsHex(socialSuperior, 256)
      const didHash = await api.query.did.socialAccount(hashedSid2)
      if (!didHash.isEmpty) {
        socket.emit('Created', {
          status: { exists: true },
          payload
        })
        return logger.info('账号已存在')
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
      const socialAccount = stringToHex(hashedSid)
      const superior = stringToHex(hashedSocial)
      api.tx.did
        .create(pubkey, address, didType, '', socialAccount, superior)
        .signAndSend(signer, { nonce },
          ({ events = [], status }) => {
            handleResult(events, status, socket, payload)
          })
        .catch(error => {
          handleError(error, 'internal error', socket, nonceManager, signer.address)
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
      handleError(error, '创建DID失败，请重试', socket)
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
            handleResult(events, status, socket, payload)
          })
        .catch(error => {
          handleError(error, 'internal error', socket, nonceManager, signer.address)
        })
    } catch (error) {
      handleError(error, "创建DID失败，请重试", socket)
    }
	return null
  })

  socket.on('sign', async payload => {
    try {
      const { address, method, params, token } = payload

      // auth check
      const ipAdd = getIPAdress()
      if (ipAdd !== '172.21.0.3' && process.env.NODE_ENV !== 'development') {
        const rs = await checkAuth(token)
        if (!rs.success) {
          return handleError(rs.message, socket)
        }
      }

      const res = fs.readFileSync(`${homedir}/.substrate/wallet/keys/${address}.json`)
      const keyring = new Keyring({ type: 'sr25519' })

      const { seed } = JSON.parse(res.toString())
      const pair = keyring.addFromMnemonic(seed)

      const { nonce } = await this.api.query.system.account(address)

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
            handleResult(events, status, socket, payload)
          }
        )
        .catch(error => {
          handleError(error, 'internal error', socket)
        })

    } catch (error) {
      handleError(error, "签名失败，请重试", socket)
    }
	return null
  })
}
