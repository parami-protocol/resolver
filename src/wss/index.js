import fs from 'fs'
import os from 'os'
import { mnemonicGenerate, blake2AsHex } from '@polkadot/util-crypto'
import Keyring from '@polkadot/keyring'
import {
  stringToHex, numberToHex, isHex, u8aToHex
} from '@polkadot/util'
import { didToHex, NonceManager, getIPAdress } from 'libs/util'
import { checkAuth } from 'libs/auth'

const homedir = os.homedir()

const handleResult = (events, status, socket, payload) => {
  console.log('Transaction status:', status.toString())
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

const handleError = (error, socket, nonceManager, address) => {
  console.log(error)
  if (address) {
    nonceManager.sub(address)
  }
  socket.emit('tx_failed', {
    msg: error
  })
}

const getSigner = () => new Promise((resolve, reject) => {
  fs.readFile(
    `${homedir}/.substrate/did:pra:LvVE2k7TDmkqKZZvbt2R7xTJdR3pK3JFMA`,
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
        .catch(e => {
          console.log(e, 'internal error')
          handleError('交易未完成，请重试', socket, nonceManager, signer.address)
        })

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
      handleError('创建DID失败，请重试', socket)
    }

    return true
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
      console.log(pubkey, address, didType, superior, socialAccount, socialSuperior, 'input data----')
      api.tx.did
        .create(pubkey, address, didType, superior, socialAccount, socialSuperior)
        .signAndSend(signer, { nonce },
          ({ events = [], status }) => {
            handleResult(events, status, socket, payload)
          })
        .catch(e => {
          console.log(e, 'internal error')
          handleError('交易未完成，请重试', socket, nonceManager, signer.address)
        })
    } catch (error) {
      console.log(error, 'create by old error')
      handleError("创建DID失败，请重试", socket)
    }
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
            handleResult(events, status, socket, payload)
          }
        )
        .catch(e => {
          console.log(e, 'internal error')
          handleError('交易未完成，请重试', socket)
        })

    } catch (error) {
      console.log(error, 'sign error-----')
      handleError("签名失败，请重试", socket)
    }
  })
}
