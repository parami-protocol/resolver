import fs from 'fs'
import os from 'os'
import { mnemonicGenerate, blake2AsHex } from '@polkadot/util-crypto'
import Keyring from '@polkadot/keyring'
import {
  u8aToHex,
  u8aToU8a,
  stringToHex,
  stringToU8a,
  numberToHex
} from '@polkadot/util'
import { didToHex } from 'libs/util'
import logger from 'libs/log'

const homedir = os.homedir()

const handleResult = (
  events,
  status,
  socket,
  payload
) => {
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
      const { event: { data, method } } = events[events.length - 2]
      const msg = data.toString()
 
      socket.emit(
        method,
        msg
      )
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

const getPair = () => {
  return new Promise((resolve, reject) => {
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
}

export default async function prochainWsServer(api, socket) {
  const signPair = await getPair()

  socket.on('create', async msg => {
    try {
      const mnemonicPhrase = mnemonicGenerate()
      const keyring = new Keyring({ type: 'sr25519' })
      const pair = keyring.addFromMnemonic(mnemonicPhrase)

      const { superior } = JSON.parse(msg)

      const { address, publicKey } = pair
      const pairKeystore = JSON.stringify(
        keyring.toJson(address, address.substr(0, 6)),
        null,
        2
      )
      const pairSeed = JSON.stringify({
        address,
        seed: mnemonicPhrase
      })
      console.log(address, 'new address')

      const nonce = await api.query.system.accountNonce(
        signPair.address
      )

      const mySuperior = didToHex(superior)
      const pubkey = u8aToHex(publicKey)
      const didType = stringToHex('1')

      api.tx.did
        .create(
          pubkey,
          address,
          didType,
          mySuperior,
          u8aToU8a([]),
          u8aToU8a([])
        )
        .signAndSend(
          signPair,
          { nonce },
          ({ events = [], status }) => {
            console.log('Transaction status:', status.type)
            handleResult(events, status, socket, 'create')
          }
        )
        .catch(e => console.log(e, 'internal error'))
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
      console.log(error, 'create error')
      handleResult({}, { error: true }, socket, 'create')
    }
  })

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
      const pair = keyring.addFromMnemonic(mnemonicPhrase)

      const { address, publicKey } = pair
      const pairKeystore = JSON.stringify(
        keyring.toJson(address, 'test123456'),
        null,
        2
      )
      const pairSeed = JSON.stringify({
        address,
        seed: mnemonicPhrase
      })
      console.log(address, 'new address')

      const nonce = await api.query.system.accountNonce(
        signPair.address
      )

      const pubkey = u8aToHex(publicKey)
      const didType = stringToHex(type)
      const socialAccount = stringToHex(hashedSid)
      const superior = stringToHex(hashedSocial)

      api.tx.did
        .create(
          pubkey,
          address,
          didType,
          '',
          socialAccount,
          superior
        )
        .signAndSend(
          signPair,
          { nonce },
          ({ events = [], status }) => {
            console.log('Transaction status:', status.type)
            handleResult(events, status, socket, msg)
          }
        )
        .catch(e => console.log(e, 'internal error'))
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
      console.log(error, 'create_by_sns error')
      handleResult(
        {},
        { error: true },
        socket,
        msg
      )
    }
    return true
  })

  socket.on('create_by_old', async msg => {
    try {
      const {
        pubkey,
        address,
        type,
        superior,
        socialAccount,
        socialSuperior,
        isInit
      } = JSON.parse(msg)

      const nonce = await api.query.system.accountNonce(
        signPair.address
      )

      const didType = stringToHex(type)

      const hashedSocialAccount = blake2AsHex(socialAccount, 256)
      const sAccount = stringToHex(hashedSocialAccount)
      let sSuperior
      
      if (isInit || !socialSuperior) {
        sSuperior = u8aToU8a([])
      } else {
        sSuperior = stringToHex(blake2AsHex(socialSuperior, 256))
      }

      api.tx.did
        .create(
          pubkey,
          address,
          didType,
          superior,
          sAccount,
          sSuperior
        )
        .signAndSend(
          signPair,
          { nonce },
          ({ events = [], status }) => {
            console.log('Transaction status:', status.type)
            handleResult(events, status, socket, msg)
          }
        )
        .catch(e => console.log(e, 'internal error'))
    } catch (error) {
      console.log(error, 'create_by_old error')
      handleResult(
        {},
        { error: true },
        socket,
        msg
      )
    }
  })

  socket.on('sign', async msg => {
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
                console.log('Transaction status:', status.type)
                handleResult(events, status, socket, msg)
              }
            )
            .catch(e => console.log(e, 'internal error'))
        } catch (error) {
          console.log(error, 'sign error-----')
          handleResult({}, { error: true }, socket, msg)
        }
        return true
      }
    )
  })
}
