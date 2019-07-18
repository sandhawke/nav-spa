const debug = require('debug')('nav-state-y')
const KeyedSet = require('keyed-set')
const EventEmitter = require('eventemitter3')
const whenDomReady = require('when-dom-ready')
const delay = require('delay')

class NavStateManager extends EventEmitter {
  constructor (options) {
    super()
    Object.assign(this, options || {})
    /* 
       - Expecting -
       this.parsePath
       this.makePath
       this.parseHash
       this.makeHash
       this.skipInit - mostly for testing without browser
    */
    this.state = {}
    if (!this.skipInit) this.queueUpInit()
    debug('constructor done')
  }
  
  /*
    Don't init immediately, so others can subscribe before we send out
    the initial batch of changes.  Also, wait for DOM, so they don't
    need to. Also, wait one more tick, in case they unnecessarily wait
    for the DOM before subscribing.
  */
  async queueUpInit () {
    debug('init starts')
    await whenDomReady()
    debug('dom ready')
    // await delay(1)
    debug('DONE DONE delay done')
    this.init(window.location)
    debug('init  done')
    this.ready = true
    this.emit('ready', this) // maybe handy; now you can use 'link'
  }
  init (url) {
    window.addEventListener('popstate', (event) => {
      this.updateFromURL(document.location)
      // ignore event.state; we believe any state restored by the BACK
      // button should be in the URL.  Does that apply even to
      // scrollstate? Hmm, to be considered.
      this.emit('change') // so visibility can be updated, I guess
    })

    const onNav = this.onNav.bind(this)
    window.addEventListener('click', onNav)
    window.addEventListener('submit', onNav)

    this.origin = url.origin
    if (url.protocol === 'file:') {
      this.file = url.protocol + url.pathname
    }
    debug('set this.file?', url, this)
    
    this.updateFromURL(url)
    debug('navState init complete, %o', this.state)
  }
  
  // intercept clicks so we don't need onclick all over the place
  onNav (event) {
    debug('onNav intercepting click')
    if (event.metaKey ||
        event.shiftKey ||
        event.altKey ||
        event.ctrlKey ||
        event.defaultPrevented
       ) return
    const target = event.target
    let href
    if (target.nodeName === 'A') {
      href = target.href
    }
    /* this kind of thing was in url-state, but not sure we want it
    else if (target.nodeName === 'FORM') {
      if (!target.action || target.action === window.location.href) {
        event.preventDefault()
        return
      }
      href = target.action
    } 
    */
    else {
      return
    }

    // because we .open() external ones, we'll never want default
    event.preventDefault()
        
    const url = new URL(href)
    
    debug('.. its a link')
    
    if (url.origin === this.origin) {
      debug('.. same origin')
      debug('pretending to nav to', href)
      window.history.pushState(null, null, href)
      this.updateFromURL(url)
    } else {
      window.open(href, '_blank')
    }
  }

  encodeInString (make, parse, state) {
    let out
    if (make) {
      out = make(state)
      if (out !== undefined) {
        const used = parse(out)
        for (const [key, value] of Object.entries(used)) {
          const oVal = state[key]
          if (oVal !== value) {
            console.error(`Error encoding state[${JSON.stringify(key)}], parse(make(${JSON.stringify(oVal)})) !== expected ${JSON.stringify(value)}`)
          }
          delete state[key]
        }
      }
    }
    return out
  }

  decodeFromString (make, parse, str) {
    if (parse) {
      const state = parse(str)
      // just a check ourselves
      const str2 = this.encodeInString(make, parse, state)
      if (str != str2) console.error(`nav-state: decodeFromString loop check failed on ${JSON.stringify(str)}`)
      return state
    }
    return {}
  }
  
  // returns the URL to use for a modified version of this state
  link (change) {
    if (!this.ready) console.error('nav.link called before ready')
    let newState = Object.assign({}, this.state)
    if (typeof change === 'function') {
      newState = change(newState)
    } else {
      Object.assign(newState, change)
    }
    debug({newState})

    // encode it into a URL
    debug('in link, file? ', this.file)
    const url = new URL(this.file ? this.file : this.origin)
    const sp = url.searchParams

    let path = this.encodeInString(this.makePath, this.parsePath, newState) || '/'
    const hash = this.encodeInString(this.makeHash, this.parseHash, newState)
    if (hash) url.hash = hash

    // don't use encodeURIComponent because it's too aggressive sometimes
    // but also let's avoid the obvious security hole
    path = path.replace(/"/g, '%22').replace(/'/g, '%27')

    if (this.file) {
      if (path !== '/') newState.pathname = path
    } else {
      url.pathname = path
    }
    for (const [key, value] of Object.entries(newState)) {
      if (value !== undefined) sp.append(key, value)
    }
    return url.href
  }

  // like link + window.location=, for when nav state changes without
  // the user clicking on a link
  jump (change) {
    const href = this.link(change)
    window.history.pushState(null, null, href)
    this.updateFromURL(href)
  }
  
  updateFromURL (url) {
    debug('updateFromURL * %o', url)
    window.url = url
    if (typeof url === 'string') {
      url = new URL(url)
    } else {
      // workaround bug?  for some reason FF's window.location has no
      // .searhParams, at least in some cases
      url = new URL(url.href)
    }
    debug('updateFromURL %o', url.href, url)
    const params = url.searchParams || new URLSearchParams()
    console.log({url, params})
    const oldState = Object.assign({}, this.state) // in case someone wants it
    let changed

    let newState = {} // be we actually end up mutating this.state

    // query params come first, so they can be overwritten by path & hash
    window.params = params
    for (const [key, newValue] of params.entries()) {
      console.log('searchparam', key, newValue)
      newState[key] = newValue
    }
    debug('searchparames done', newState)

    let path = url.pathname
    if (this.file) {
      path = '/' + (newState.path || '')
      delete newState.path
    }
    Object.assign(newState, this.decodeFromString(
      this.makePath, this.parsePath, path))
    Object.assign(newState, this.decodeFromString(
      this.makeHash, this.parseHash, url.hash))
    debug('final newState: %o', newState)
    debug('and   oldState: %o', oldState)

    // delete any keys absent in the new state
    for (const key of Object.keys(this.state)) {
      if (!newState.hasOwnProperty(key) ||
          newState[key] === undefined ||
          newState[key] === null) {
        debug('have to delete value for', key)
        const oldValue = this.state[key]
        delete this.state[key]
        const newValue = undefined
        this.emit(`change-${key}`, { key, oldValue, newValue })
      }
    }

    // modify values for any keys present in the new state
    for (const [key, newValue] of Object.entries(newState)) {
      const oldValue = this.state[key]
      debug('newstate has', key, newValue, oldValue, oldValue !== newValue)
      if (oldValue !== newValue) {
        this.state[key] = newValue
        this.emit(`change-${key}`, { key, oldValue, newValue })
        changed = true
      }
    }

    if (changed) this.emit('change', { newState, oldState })
    debug('final state: %o', this.state)
  }
}

// usually it's fine to just have the one instance
const nav = new NavStateManager()
      
module.exports = { nav, NavStateManager }
