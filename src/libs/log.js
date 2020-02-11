const log4js = require('log4js')

log4js.configure({
  appenders: {
	out: { type: 'console' },
    log_file: {
      type: 'dateFile',
      filename: './logs/log_file',
      pattern: "yyyy-MM-dd.log",
      alwaysIncludePattern: true,
    }
  },
  categories: {
    default: {
      appenders: ['out', 'log_file'],
      level: 'debug'
    }
  }
})

export default log4js.getLogger()
