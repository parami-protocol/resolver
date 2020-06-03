import os from 'os'
import fs from 'fs'
import { Kafka } from 'kafkajs'
import Keyring from '@polkadot/keyring'
import { numberToHex } from '@polkadot/util'
import { didToHex, NonceManager, getRecords } from 'libs/util'
import { kafkaLogger } from 'libs/log'
import Datastore from 'nedb'

const reissue = new Datastore({ filename: './db/reissue', autoload: true })

const handleKafkaEvent = (events, status, producer, payload) => {
  const {
    id, fromDid, trx, module, method
  } = payload
  kafkaLogger.info('Transaction status:', status.type)
  if (status.type === 'Future' || status.type === 'Invalid') {
    // const newNonce = nonceManager.sub(address)
    // kafkaLogger.info(`reset nonce to ${newNonce} for address: ${address}`)
    process.exit(0)
  }
  if (status.isInBlock) {
    const blockHash = status.asInBlock.toHex()
    producer.send({
      topic: 'topic_testnet_transfer_callback',
      messages: [
        {
          value: JSON.stringify({
            id,
            trx,
            block_hash: blockHash,
            module,
            method
          })
        }
      ]
    })
  } else if (status.isFinalized) {
    const hash = status.asFinalized.toHex()
    kafkaLogger.info('Completed at block hash', hash)
    kafkaLogger.info('Events:')

    let isSuccessful = true
    events.forEach(({ phase, event: { data, method, section } }) => {
      kafkaLogger.info(
        '\t',
        phase.toString(),
        `: ${section}.${method}`,
        data.toString()
      )
      if (method.includes('ExtrinsicFailed')) isSuccessful = false
    })

    const tstatus = isSuccessful ? 1 : 2
    kafkaLogger.info(id, tstatus, hash)

    // kafka transfer record
    if (isSuccessful) {
      const transferRecord = {
        id: `${fromDid}_${id}`,
        hash
      }

      reissue.insert(transferRecord, (err) => {
        if (err) {
          kafkaLogger.error('insert transfer record error')
        }
      })
    }

    producer.send({
      topic: 'topic_testnet_transfer_callback',
      messages: [
        {
          value: JSON.stringify({
            id,
            status: tstatus,
            module,
            method
          })
        }
      ]
    })
  }
}

export default async function kafkaConsumer(api) {
  const homedir = os.homedir()
  const kafka = new Kafka({
    clientId: 'my-app',
    brokers: ['172.21.0.23:9092']
  })
  const producer = kafka.producer()
  const consumer = kafka.consumer({ groupId: 'group-test' })
  const nonceManager = new NonceManager(api)

  try {
    // Producing
    await producer.connect()

    // Consuming
    await consumer.connect()
    await consumer.subscribe({
      topic: 'topic_testnet_transfer',
      fromBeginning: true
    })

    await consumer.run({
      eachMessage: async ({ message }) => {
        try {
          // {"id":"ba40d230-95be-4636-8097-77f57825d343","from_did":"did:pra:LicW6oeEuLny8w9psXwvgAewBrgVb6iBT2","module":"ads","method":"distribute","parameters":[0,"did:pra:LkHmbT5qCubLfMBtyfzJHW8UEUopKprfTR"]}
          // const {
          //   id, from_did: fromDid, to_did: toDid, amount, memo
          // } = JSON.parse(message.value.toString())
          const {
            id, from_did: fromDid, module, method, parameters
          } = JSON.parse(message.value.toString())
          const record = await getRecords(reissue, { id: `${fromDid}_${id}` })
          if (record) {
            kafkaLogger.info('this transaction already sent')
            return
          }

          const res = fs.readFileSync(`${homedir}/.substrate/${fromDid}`)
          const keyring = new Keyring({ type: 'sr25519' })
          const seed = res.toString().replace(/[\r\n]/g, '')
          const pair = keyring.addFromMnemonic(seed)
          // const receiver = didToHex(toDid)
          const nonce = await nonceManager.getNonce(pair.address)
          kafkaLogger.info(fromDid, parameters, nonce, 'kafka transaction')

          // transfer from airdrop account
          // const utx = api.tx.did
          // .transfer(receiver, numberToHex(+amount), memo).sign(pair, { nonce })
          const utx = api.tx[module][method](...parameters).sign(pair, { nonce })
          const trxHash = utx.hash.toHex()
          console.log(trxHash, 'transaction hash')
          utx.send(({ events = [], status }) => {
            const payload = {
              id,
              fromDid,
              address: pair.address,
              trx: trxHash,
              module,
              method
            }
            handleKafkaEvent(events, status, producer, payload)
          })
            .catch(e => {
              kafkaLogger.error(e, 'kafka internal error')
              // const newNonce = nonceManager.sub(pair.address)
              // kafkaLogger.info(`reset nonce to ${newNonce} for address: ${pair.address}`)
              process.exit(0)
            })
        } catch (error) {
          kafkaLogger.error(error, 'kafka external error')
        }
      }
    })
  } catch (error) {
    kafkaLogger.error(error, 'kafka error')
  }
}
