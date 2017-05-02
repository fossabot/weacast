const path = require('path')
const logger = require('winston')
const compress = require('compression')
const cors = require('cors')
const helmet = require('helmet')
const bodyParser = require('body-parser')
const proxyMiddleware = require('http-proxy-middleware')

const feathers = require('feathers')
const configuration = require('feathers-configuration')
const hooks = require('feathers-hooks')
const rest = require('feathers-rest')
const socketio = require('feathers-socketio')

const middleware = require('./middleware')
const services = require('./services')
const appHooks = require('./main.hooks')

const authentication = require('./authentication')

import { Database } from './db'

export class Server {
  constructor() {
    this.app = feathers()
    // Load app configuration
    this.app.configure(configuration(path.join(__dirname, '..')))
    // Initialize DB
    this.app.db = Database.create(this.app)
    // Serve pure static assets
    if (process.env.NODE_ENV === 'production') {
      this.app.use(this.app.get('client').build.publicPath, feathers.static('../dist'))
    }
    else {
      const staticsPath = path.posix.join(this.app.get('client').dev.publicPath, 'statics/')
      this.app.use(staticsPath, feathers.static('../client/statics'))
    }

    // Define HTTP proxies to your custom API backend. See /config/index.js -> proxyTable
    // https://github.com/chimurai/http-proxy-middleware
    Object.keys(this.app.get('proxyTable')).forEach( (context) => {
      let options = this.config.this.app.get('proxyTable')[context]
      if (typeof options === 'string') {
        options = { target: options }
      }
      this.app.use(proxyMiddleware(context, options))
    })

    // Enable CORS, security, compression, favicon and body parsing
    this.app.use(cors())
    this.app.use(helmet())
    this.app.use(compress())
    this.app.use(bodyParser.json())
    this.app.use(bodyParser.urlencoded({ extended: true }))
  }

  async run () {
    // First try to connect to DB
    await this.app.db.connect()
    
    const port = this.app.get('port')
    // Set up Plugins and providers
    this.app.configure(hooks())
    this.app.configure(rest())
    this.app.configure(socketio())

    this.app.configure(authentication)

    // Set up our services (see `services/index.js`)
    this.app.configure(services)
    // Configure middleware (see `middleware/index.js`) - always has to be last
    this.app.configure(middleware)
    this.app.hooks(appHooks)
    
    // Last lauch server
    await this.app.listen(port)
  }
}