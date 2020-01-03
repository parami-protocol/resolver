import fs from 'fs'
import os from 'os'
import bs58 from 'bs58'
import { blake2AsHex } from '@polkadot/util-crypto'
import { hexToString, isHex } from '@polkadot/util'
import crypto from 'crypto'
import { ApiPromise, WsProvider } from '@polkadot/api'
import types from 'libs/types'

require('dotenv').config({
  path: `.env${process.env.NODE_ENV ? '.development' : ''}`
})

const provider = new WsProvider(process.env.SUBSTRATE_HOST)

const algorithm = 'aes-256-ctr'
let key = 'MySuperSecretKey'
key = crypto
  .createHash('sha256')
  .update(String(key))
  .digest('base64')
  .substr(0, 32)

/**
 * 读取路径信息
 * @param {string} path 路径
 */
export function getStat(path) {
  return new Promise(resolve => {
    fs.stat(path, (err, stats) => {
      if (err) {
        resolve(false)
      } else {
        resolve(stats)
      }
    })
  })
}

/**
 *  创建路径
 *  @param {string} dir 路径
 */
export function mkdir(dir) {
  return new Promise(resolve => {
    fs.mkdir(dir, err => {
      if (err) {
        resolve(false)
      } else {
        resolve(true)
      }
    })
  })
}

/**
 *  路径是否存在，不存在则创建
 *  @param {string} dir 路径
 */
export async function dirExists(dir, path) {
  const isExists = await getStat(dir)
  //  如果该路径且不是文件，返回true
  if (isExists && isExists.isDirectory()) {
    return true
  }
  if (isExists) {
    return false
  }
  //  如果该路径不存在
  const tempDir = path.parse(dir).dir
  //  递归判断，如果上级目录也不存在，则会代码会在此处继续循环执行，直到目录存在
  const status = await dirExists(tempDir)
  let mkdirStatus
  if (status) {
    mkdirStatus = await mkdir(dir)
  }
  return mkdirStatus
}

export function didToHex(did) {
  if (!did) return ''
  const bytes = bs58.decode(did.substring(8))
  return blake2AsHex(bytes, 256)
}

export function hexToDid(hex) {
  const bytes = Buffer.from(hex.slice(2), 'hex')
  const address = bs58.encode(bytes)
  const did = `did:pra:${address}`

  return did
}

export function encrypt(buffer) {
  // Create an initialization vector
  const iv = crypto.randomBytes(16)
  // Create a new cipher using the algorithm, key, and iv
  const cipher = crypto.createCipheriv(algorithm, key, iv)
  // Create the new (encrypted) buffer
  const result = Buffer.concat([
    iv,
    cipher.update(buffer),
    cipher.final()
  ])
  return result
}

export function decrypt(encrypted) {
  // Get the iv: the first 16 bytes
  const iv = encrypted.slice(0, 16)
  // Get the rest
  const encrypteds = encrypted.slice(16)
  // Create a decipher
  const decipher = crypto.createDecipheriv(algorithm, key, iv)
  // Actually decrypt it
  const result = Buffer.concat([
    decipher.update(encrypteds),
    decipher.final()
  ])
  return result
}

export async function createApi() {
  const api = await ApiPromise.create({
    provider,
    types
  })
  console.log('api created-----')

  return api
}

export function formatHexNumber(hexNum) {
  let result
  if (isHex(hexNum)) {
    result = hexNum.toString() / 10 ** 15
  } else if (typeof hexNum === 'number') {
    result = hexNum / 10 ** 15
  }
  return result
}

export function metadataFormat(metadata) {
  /* eslint-disable */
  for (const key in metadata) {
    if ({}.hasOwnProperty.call(metadata, key)) {
      const item = metadata[key]
      switch (key) {
        case 'did':
          metadata[key] = hexToDid(item)
          break
        case 'external_address': {
          let { btc, eos, eth } = item
          eos = hexToString(eos)
          btc = hexToString(btc)
          eth = hexToString(eth)
          if (eth) {
            eth = '0x' + eth
          }
          metadata[key] = { btc, eth, eos }
          break
        }
        case 'locked_records':
        case 'unlocked_records': {
          if (item) {
            for (let kk in item) {
              if ({}.hasOwnProperty.call(item, kk)) {
                if (kk === 'locked_funds' || kk === 'unlocked_funds' || kk === 'max_quota') {
                  item[kk] = formatHexNumber(item[kk])
                } else if (isHex(item[kk])) {
                  item[kk] = +item[kk].toString()
                }
              }
            }
          }
          break
        }
        default:
          break
      }
    }
  }
  return metadata
}

export function getEventSections() {
  const sections = process.env.SUBSTRATE_EVENT_SECTIONS;
  if (sections) {
      return sections.split(',');
  } else {
      return ["all"]
  }
}

/*
获取本机IP
*/
export function getIPAdress() {  
  let interfaces = os.networkInterfaces()
  for (let devName in interfaces) {
    let iface = interfaces[devName]
    for (let i=0;i < iface.length; i++) {
      let alias = iface[i];  
      if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {  
        return alias.address
      }
    }
  }  
} 

export class NonceManager {
  constructor(api) {
    this.api = api
    this.timerMap = {}
  }

  async init(address) {
    global.nonceMap[address] = await this.api.query.system.accountNonce(address)

    this.update(address)

    return global.nonceMap[address]
  }

  exists(address) {
    if (global.nonceMap[address]) {
      return true
    } else {
      return false
    }
  }

  async getNonce(address) {
    if (!this.exists(address)) {
      return await this.init(address)
    }

    return this.add(address)
  }

  add(address) {
    global.nonceMap[address] = global.nonceMap[address] - 0 + 1
    return global.nonceMap[address]
  }

  sub(address) {
    global.nonceMap[address] = global.nonceMap[address] -= 1
    return global.nonceMap[address]
  }

  update(address) {
    const curTimer = this.timerMap[address]
    if (curTimer) clearInterval(curTimer)
    this.timerMap[address] = setInterval(async () => {
      global.nonceMap[address] = await this.api.query.system.accountNonce(address)
      console.log(
        'new nonce for address:',
        address,
        global.nonceMap[address].toNumber()
      )
    }, 1000 * 20)
  }
}