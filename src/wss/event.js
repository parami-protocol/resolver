import { hexToString } from '@polkadot/util'
import { getEventSections, hexToDid } from 'libs/util'

export default async function prochainEvents(api, io) {
  const hashName = global.hashName
  const eventsFilter = getEventSections()

  api.query.system.events(events => {
    // Loop through the Vec<EventRecord>
    events.forEach(async record => {
      // Extract the phase, event and the event types
      const { event, phase } = record

      // const types = event.typeDef
      // check section filter
      if (
        eventsFilter.includes(event.section.toString()) ||
        eventsFilter.includes('all')
      ) {
        const { section, method, data } = event
        let dataJson = data.toJSON()

        console.log(section, method, phase.toString())

        if (section === 'did') {
          switch (method) {
            case 'Created': {
              const did = hexToDid(dataJson[0])
              const superiorDid = hexToDid(dataJson[2])
              const socketId = hashName[superiorDid]
              const toSocket = io.sockets.connected[socketId]
              if (toSocket) {
                toSocket.emit(
                  method,
                  JSON.stringify([did, superiorDid])
                )
              }
            }
              break
            default:
              break
          }
        }
        
        // Loop through each of the parameters, displaying the type and data
        // event.data.forEach((data, index) => {
        //   console.log(`\t\t\t${types[index].type}: ${data.toString()}`)
        // })
      }
    })
  })
}
