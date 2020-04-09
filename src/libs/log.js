const log4js = require('log4js')

log4js.configure({
  appenders: {
    out: { type: 'console' },
    log_file: {
      type: 'dateFile',
      filename: './logs/log_file',
      pattern: 'yyyy-MM-dd.log',
      alwaysIncludePattern: true
    },
    // kafka logs
    kafkaLog: {
      type: 'dateFile',
      filename: './logs/kafka/transfer',
      pattern: 'yyyy-MM-dd.log',
      maxLogSize: 10485760,
      alwaysIncludePattern: true
    }
  },
  categories: {
    default: {
      appenders: ['out', 'log_file'],
      level: 'debug'
    },
    kafka: {
      appenders: ['out', 'kafkaLog'],
      level: 'debug'
    }
  }
})

export default log4js.getLogger()
export const kafkaLogger = log4js.getLogger('kafka')
