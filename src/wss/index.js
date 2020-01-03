import fs from 'fs'
import os from 'os'
import { mnemonicGenerate, blake2AsHex } from '@polkadot/util-crypto'
import Keyring from '@polkadot/keyring'
import { stringToHex, stringToU8a, numberToHex } from '@polkadot/util'
import { didToHex, NonceManager, getIPAdress } from 'libs/util'
import { checkAuth } from 'libs/auth'
import logger from 'libs/log'

const homedir = os.homedir()

const handleResult = (events, status, socket, payload) => {
  console.log('Transaction status:', status.type)
  if (status.isFinalized) {
    console.log('Completed at block hash', status.asFinalized.toHex())
    console.log('Events:')

    let txStatus = true
    events.forEach(({ phase, event: { data, section, method } }) => {
      console.log(
        '\t',
        phase.toString(),
        `: ${section}.${method}`,
        data.toString()
      )
      if (method.includes('ExtrinsicFailed')) {
        txStatus = false
      }
    })

    if (txStatus) {
      const {
        event: { data, method }
      } = events[events.length - 2]
      const msg = data.toString()

      socket.emit(method, msg)
    } else {
      socket.emit(
        'tx_failed',
        JSON.stringify({
          payload,
          msg: 'sign error, please check your params'
        })
      )
      logger.error(payload)
    }
  } else if (status.exists) {
    socket.emit(
      'Created',
      JSON.stringify({
        status,
        payload
      })
    )
  } else if (status.error) {
    socket.emit(
      'tx_failed',
      JSON.stringify({
        msg: 'sign error, please try again',
        payload
      })
    )
  }
}

const handleInternalError = (error, address, nonceManager) => {
  logger.error(error, 'internal error')
  console.log(error, 'internal error')
  if (address) {
    nonceManager.sub(address)
  }
}

const getSigner = () => new Promise((resolve, reject) => {
  fs.readFile(
    `${homedir}/.substrate/prochain-fund-account`,
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

  socket.on('create_by_sns', async msg => {
    try {
      const { sid, type, socialSuperior } = JSON.parse(msg)
      // social accounnt
      const hashedSid = blake2AsHex(sid, 256)
      const hash = blake2AsHex(stringToU8a(`${hashedSid}1`), 256)

      // social superior
      const hashedSocial = blake2AsHex(socialSuperior, 256)
      const socialHash = await api.query.did.socialAccount(hash)
      if (!socialHash.isEmpty) {
        handleResult([], { exists: true }, socket, msg)
        return console.log('账号已存在')
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
      const didType = stringToHex(type)
      const socialAccount = stringToHex(hashedSid)
      const superior = stringToHex(hashedSocial)
      api.tx.did
        .create(publicKey, address, didType, '', socialAccount, superior)
        .signAndSend(signer, { nonce },
          ({ events = [], status }) => {
            handleResult(events, status, socket, msg)
          })
        .catch(e => handleInternalError(e, signer.address, nonceManager))

      fs.writeFile(
        `${homedir}/.substrate/wallet/key_stores/${address}.json`,
        pairKeystore,
        err => {
          if (err) return console.log(err)
          console.log('create key pair successfully')
          return true
        }
      )

      fs.writeFile(
        `${homedir}/.substrate/wallet/keys/${address}.json`,
        pairSeed,
        err => {
          if (err) return console.log(err)
          console.log('save pair seed successfully')
          return true
        }
      )
    } catch (error) {
      console.log(error, 'create by sns error')
      handleResult({}, { error: true }, socket, msg)
    }
    return true
  })

  socket.on('create_by_old', async msg => {
    try {
      /* eslint-disable */
      let { pubkey, address, didType, superior, socialAccount, socialSuperior } = JSON.parse(msg)
      const nonce = await nonceManager.getNonce(signer.address)

      superior = superior && didToHex(superior)
      didType = stringToHex(didType)
      socialAccount = socialAccount && stringToHex(blake2AsHex(socialAccount, 256))
      socialSuperior = socialSuperior && stringToHex(blake2AsHex(socialSuperior, 256))

      api.tx.did
        .create(pubkey, address, didType, superior, socialAccount, socialSuperior)
        .signAndSend(signer, { nonce },
          ({ events = [], status }) => {
            handleResult(events, status, socket, msg)
          })
        .catch(e => handleInternalError(e, signer.address, nonceManager))
    } catch (error) {
      console.log(error, 'create_by_old error')
      handleResult({}, { error: true }, socket, msg)
    }
  })

  socket.on('sign', async msg => {
    try {
      const { address, method, params, token } = JSON.parse(msg)

      // auth check
      const ipAdd = getIPAdress()
      if (ipAdd !== '172.21.0.3') {
        const rs = await checkAuth(token)
        if (!rs.success) {
          console.log(rs.message)
          handleResult({}, { error: true }, socket, rs.message)
          return false
        }
      }

      const res = fs.readFileSync(`${homedir}/.substrate/wallet/keys/${address}.json`)
      const keyring = new Keyring({ type: 'sr25519' })

      const { seed } = JSON.parse(res.toString())
      const pair = keyring.addFromMnemonic(seed)

      const nonce = await api.query.system.accountNonce(address)

      /*  eslint no-plusplus: ["error", { "allowForLoopAfterthoughts": true }]  */
      for (let i = 0; i < params.length; i++) {
        const num = params[i]
        if (typeof num === 'number') {
          params[i] = numberToHex(num)
        }
      }

      console.log(address, method, params, 'sign')
      api.tx.did[method](...params)
        .signAndSend(pair, { nonce },
          ({ events = [], status }) => {
            handleResult(events, status, socket, msg)
          }
        )
        .catch(handleInternalError)
    } catch (error) {
      console.log(error, 'sign error-----')
      handleResult({}, { error: true }, socket, msg)
    }
  })
}
