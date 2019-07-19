const debug = require('debug')('nav-state-y')
const KeyedSet = require('keyed-set')
const EventEmitter = require('eventemitter3')
const whenDomReady = require('when-dom-ready')
const delay = require('delay')
const { shallowEqualObjects } = require('shallow-equal')

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

       Might be cleaner as this.customPath.make / .parse
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
    this.emit('ready', this) // maybe handy; now you can use 'link'
  }
  init (url) {
    window.addEventListener('popstate', (event) => {
      this.updateFromURL(document.location)
      // ignore event.state; we believe any state restored by the BACK
      // button should be in the URL.  Does that apply even to
      // scrollstate? Hmm, to be considered.
    })

    const onNav = this.onNav.bind(this)
    window.addEventListener('click', onNav)
    window.addEventListener('submit', onNav)

    this.origin = url.origin
    if (url.protocol === 'file:') {
      this.file = url.protocol + url.pathname
    }
    debug('set this.file?', url, this)

    this.ready = true

    this.updateFromURL(url)
    debug('navState init complete, %o', this.state)
  }
  
  // intercept clicks so we don't need onclick all over the place
  onNav (event) {
    debug('onNav intercepting click', event)
    if (event.metaKey ||
        event.shiftKey ||
        event.altKey ||
        event.ctrlKey ||
        event.defaultPrevented
       ) {
      debug('ignoring it for one of our initial reasons')
      return
    }
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
  //
  // give some extra details in the report object
  link (change, report) {
    if (!this.ready) console.error('nav.link called before ready')
    let newState = Object.assign({}, this.state)
    if (typeof change === 'function') {
      newState = change(newState)
    } else {
      Object.assign(newState, change)
    }
    // debug({newState})

    // encode it into a URL
    // debug('in link, file? ', this.file)
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
      if (value !== undefined && value !== null && value !== '') {
        let str = value
        if (typeof str !== 'string') {
          str = JSON.stringify(str)
          // but it's up to you to see what's going on and parse it back out;
          // this is just for convience in describing next states.
        } 
        sp.append(key, str)
      }
    }
    if (report) report.newState = newState
    return url.href
  }

  // like link + window.location=, for when nav state changes without
  // the user clicking on a link
  jump (change, options) {
    const href = this.link(change)
    if (options && options.noHistory) {
      window.history.replaceState(null, null, href)
    } else {
      window.history.pushState(null, null, href)
    }
    this.updateFromURL(href)
  }
  
  updateFromURL (url) {
    const atEnd = []
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
    // console.log({url, params})
    const oldState = Object.assign({}, this.state) // in case someone wants it
    let changed

    let newState = {} // but we actually end up mutating this.state

    // query params come first, so they can be overwritten by path & hash
    window.params = params
    for (const [key, newValue] of params.entries()) {
      // console.log('searchparam', key, newValue)
      newState[key] = newValue
    }
    debug('copied search params into newState: %o', newState)

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
        changed = true
        const newValue = undefined
        atEnd.push(() => {this.emit(`change-${key}`, { key, oldValue, newValue })})
      }
    }

    // modify values for any keys present in the new state
    for (const [key, newValue] of Object.entries(newState)) {
      const oldValue = this.state[key]
      debug('newstate has', key, newValue, oldValue, oldValue !== newValue)
      if (oldValue !== newValue) {
        this.state[key] = newValue
        atEnd.push(() => {this.emit(`change-${key}`, { key, oldValue, newValue })})
        changed = true
      }
    }

    if (changed) {
      atEnd.push(() => {this.emit(`change`, { newState, oldState })})
      if (!shallowEqualObjects(newState, this.state)) {
        console.error('bug newState!=state', {url, oldState, newState, state: this.state})
      }
    } else {
      if (!shallowEqualObjects(this.state, oldState)) {
        console.error('bug oldState!=state when no change', {url, oldState, newState, state: this.state})
      }
    }
    debug('final state: %o', this.state)

    // Modify href fields set with data-link-to-state so they are
    // relative to the current state.  This is important for things
    // like folks copying the URL following it. We could use that
    // field ourselves, but let's avoid that error path by using
    // the href like everyone else.
    for (const elem of document.querySelectorAll('a[data-link-to-state]')) {
      // debug('elem', elem)
      let change = elem.getAttribute('data-link-to-state')
      // debug('change = ', change)
      change = eval(`( ${change} )`)
      // debug('change = ', change)
      const report = {}
      elem.setAttribute('href', this.link(change, report))
      if (shallowEqualObjects( report.newState, this.state )) {
        elem.classList.add('href-to-here')
        elem.classList.remove('href-to-away')
      } else {
        elem.classList.add('href-to-away')
        elem.classList.remove('href-to-here')
      }
    }

    // save the emits for the end, because they might call nav.jump
    // which would land as back in this function, on a re-entrant
    // call, which isn't going to work well, since they're sharing
    // this.state and we have a promise to emit changes in the order
    // they happen.
    for (const f of atEnd) f()
  }
}

// usually it's fine to just have the one instance
const nav = new NavStateManager()
      
module.exports = { nav, NavStateManager }

window.dbg = () => { window.localStorage.setItem('debug', '*') }
window.ndbg = () => { window.localStorage.setItem('debug', '') }