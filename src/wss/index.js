import fs from 'fs'
import os from 'os'
import { mnemonicGenerate, blake2AsHex } from '@polkadot/util-crypto'
import Keyring from '@polkadot/keyring'
import { stringToHex, stringToU8a, numberToHex } from '@polkadot/util'
import { didToHex } from 'libs/util'
import { checkAuth } from 'libs/auth'
import logger from 'libs/log'

const homedir = os.homedir()

// 全局手动管理nonce
global.nonceMap = {}

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
        origin,
        msg: 'sign error, please try again',
        payload
      })
    )
  }
}

const handleInternalError = (e, address) => {
  logger.error(e, 'internal error')
  console.log(e, 'internal error')
  if (address) {
    global.nonceMap[address] -= 1
  }
}

const updateNonceTimer = (api, address) => {
  setInterval(async () => {
    global.nonceMap[address] = await api.query.system.accountNonce(
      address
    )
    console.log(
      'new nonce for address:',
      address,
      global.nonceMap[address]
    )
  }, 1000 * 60)
}

const getSigner = (api) => new Promise((resolve, reject) => {
  fs.readFile(
    `${homedir}/.substrate/prochain-fund-account`,
    async (err, res) => {
      if (err) {
        reject(err)
      } else {
        const keyring = new Keyring({ type: 'sr25519' })

        const seed = res.toString().replace(/[\r\n]/g, '')
        const pair = keyring.addFromMnemonic(seed)

        global.nonceMap[pair.address] = await api.query.system.accountNonce(pair.address)

        resolve(pair)
      }
    }
  )
})

export default async function prochainWsServer(api, socket) {
  const signer = await getSigner(api)

  updateNonceTimer(api, signer.address)
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

      // increase nonce
      global.nonceMap[signer.address] += 1

      const nonce = global.nonceMap[signer.address]
      const didType = stringToHex(type)
      const socialAccount = stringToHex(hashedSid)
      const superior = stringToHex(hashedSocial)
      api.tx.did
        .create(publicKey, address, didType, '', socialAccount, superior)
        .signAndSend(signer, { nonce },
          ({ events = [], status }) => {
            handleResult(events, status, socket, msg)
          })
        .catch(e => handleInternalError(e, signer.address))

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

      // increase nonce
      global.nonceMap[signer.address] += 1

      const nonce = global.nonceMap[signer.address]

      superior = superior && didToHex(superior)
      didType = stringToHex(didType)
      socialAccount = socialAccount && stringToHex(blake2AsHex(socialAccount, 256))
      socialSuperior = socialSuperior && stringToHex(blake2AsHex(socialSuperior, 256))

      api.tx.did
        .create(
          pubkey,
          address,
          didType,
          superior,
          socialAccount,
          socialSuperior
        )
        .signAndSend(signer, { nonce },
          ({ events = [], status }) => {
            handleResult(events, status, socket, msg)
          })
        .catch(e => handleInternalError(e, signer.address))
    } catch (error) {
      console.log(error, 'create_by_old error')
      handleResult({}, { error: true }, socket, msg)
    }
  })

  socket.on('sign', async msg => {
    await checkAuth()
    const { address, method, params } = JSON.parse(msg)
    console.log(address, method, params, 'sign')

    fs.readFile(
      `${homedir}/.substrate/wallet/keys/${address}.json`,
      async (err, res) => {
        if (err) return console.log(err, 'read key json failed')
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

        try {
          api.tx.did[method](...params)
            .signAndSend(
              pair,
              { nonce },
              ({ events = [], status }) => {
                handleResult(events, status, socket, msg)
              }
            )
            .catch(handleInternalError)
        } catch (error) {
          console.log(error, 'sign error-----')
          handleResult({}, { error: true }, socket, msg)
        }
        return true
      }
    )
  })
}
