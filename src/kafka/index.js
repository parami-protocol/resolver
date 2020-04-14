import os from 'os'
import fs from 'fs'
import { Kafka } from 'kafkajs'
import Keyring from '@polkadot/keyring'
import { numberToHex } from '@polkadot/util'
import { didToHex, NonceManager } from 'libs/util'
import { kafkaLogger } from 'libs/log'
import Datastore from 'nedb'

const db = new Datastore({ filename: './db/reissue', autoload: true })
const getRecords = async (id) => new Promise((resolve, reject) => {
  db.findOne({ id }, (err, docs) => {
    if (err) {
      reject(err)
    } else {
      resolve(docs)
    }
  })
})

const handleKafkaEvent = (events, status, producer, payload) => {
  const { id, fromDid, toDid } = payload
  kafkaLogger.info('Transaction status:', status.type)
  if (status.type === 'Future' || status.type === 'Invalid') {
    // const newNonce = nonceManager.sub(address)
    // kafkaLogger.info(`reset nonce to ${newNonce} for address: ${address}`)
    process.exit(0)
  }
  if (status.isFinalized) {
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
    kafkaLogger.info(toDid, id, tstatus, hash)

    // kafka transfer record
    if (isSuccessful) {
      const transferRecord = {
        id: `${fromDid}_${id}`,
        hash
      }

      db.insert(transferRecord, (err) => {
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
            trx: hash
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
          const {
            id, from_did: fromDid, to_did: toDid, amount, memo
          } = JSON.parse(message.value.toString())

          const record = await getRecords(`${fromDid}_${id}`)
          if (record) {
            kafkaLogger.info('this transaction already sent')
            return
          }

          const res = fs.readFileSync(`${homedir}/.substrate/${fromDid}`)
          const keyring = new Keyring({ type: 'sr25519' })
          const seed = res.toString().replace(/[\r\n]/g, '')
          const pair = keyring.addFromMnemonic(seed)
          const receiver = didToHex(toDid)
          const nonce = await nonceManager.getNonce(pair.address)
          kafkaLogger.info(fromDid, toDid, amount, nonce, 'kafka transfer')

          // transfer from airdrop account
          api.tx.did
            .transfer(receiver, numberToHex(+amount), memo)
            .signAndSend(pair, { nonce },
              ({ events = [], status }) => {
                const payload = {
                  id,
                  fromDid,
                  toDid,
                  address: pair.address
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
