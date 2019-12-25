const log4js = require('log4js')

log4js.configure({
  appenders: {
    file: {
      type: 'file',
      filename: './logs/error.log',
      layout: {
        type: 'pattern',
        pattern: '%d{MM/dd-hh:mm.ss.SSS} %p - %m'
      }
    }
  },
  categories: {
    default: {
      appenders: ['file'],
      level: 'debug'
    }
  }
})

export default log4js.getLogger()
