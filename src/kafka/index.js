import os from 'os'
import fs from 'fs'
import { Kafka } from 'kafkajs'
import Keyring from '@polkadot/keyring'
import { numberToHex } from '@polkadot/util'
import { didToHex, NonceManager } from 'libs/util'
import logger from 'libs/log'

const handleKafkaEvent = (events, status, id, producer) => {
  logger.info('Transaction status:', status.type)
  if (status.isFinalized) {
    const hash = status.asFinalized.toHex()
    logger.info('Completed at block hash', hash)
    logger.info('Events:')

    let isSuccessful = true
    events.forEach(({ phase, event: { data, method, section } }) => {
      logger.info(
        '\t',
        phase.toString(),
        `: ${section}.${method}`,
        data.toString()
      )
      if (method.includes('ExtrinsicFailed')) isSuccessful = false
    })

    const tstatus = isSuccessful ? 1 : 2
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

          const res = fs.readFileSync(`${homedir}/.substrate/${fromDid}`)
          const keyring = new Keyring({ type: 'sr25519' })
          const seed = res.toString().replace(/[\r\n]/g, '')
          const pair = keyring.addFromMnemonic(seed)
          const receiver = didToHex(toDid)
          const nonce = await nonceManager.getNonce(pair.address)
          logger.info(fromDid, toDid, amount, nonce, 'kafka transfer')

          // transfer from airdrop account
          api.tx.did
            .transfer(receiver, numberToHex(+amount), memo)
            .signAndSend(pair, { nonce },
              ({ events = [], status }) => {
                handleKafkaEvent(events, status, id, producer)
              })
            .catch(e => {
              logger.error(e, 'kafka internal error')
              nonceManager.sub(pair.address)
            })
        } catch (error) {
          logger.error(error, 'kafka external error')
        }
      }
    })
  } catch (error) {
    logger.error(error, 'kafka error')
  }
}
