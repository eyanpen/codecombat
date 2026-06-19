/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
(function (setupLodash) {
  global._ = require('lodash')
  _.str = require('underscore.string')
  return _.mixin(_.str.exports())
})(this)

const express = require('express')
const http = require('http')
const serverSetup = require('./server_setup')
const co = require('co')
const config = require('./server_config')
const Promise = require('bluebird')

module.exports.startServer = function (done) {
  const { connect } = require('./server/database')
  const config = require('./server_config')
  if (config.proxy) {
    // Proxy mode: no database needed
    const app = createAndConfigureApp()
    const httpServer = http.createServer(app).listen(app.get('port'), () => typeof done === 'function' ? done() : undefined)
    console.info('Express SSL server listening on port ' + app.get('port'))
    return { app, httpServer }
  }
  // Normal mode: connect to MongoDB first
  connect().then(() => {
    const app = createAndConfigureApp()
    const httpServer = http.createServer(app).listen(app.get('port'), () => typeof done === 'function' ? done() : undefined)
    console.info('Express SSL server listening on port ' + app.get('port'))
    return { app, httpServer }
  }).catch(err => {
    console.error('Failed to connect to MongoDB:', err.message)
    process.exit(1)
  })
}

const createAndConfigureApp = (module.exports.createAndConfigureApp = function () {
  const app = express()
  if (config.forceCompression) {
    const compression = require('compression')
    app.use(compression())
  }
  serverSetup.setExpressConfigurationOptions(app)
  serverSetup.setupMiddleware(app)
  return app
})
