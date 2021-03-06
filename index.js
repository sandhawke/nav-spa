const debug = require('debug')('nav-spa')
const EventEmitter = require('eventemitter3')
let whenDomReady = require('when-dom-ready')
const delay = require('delay')
const { shallowEqualObjects } = require('shallow-equal')

// console.error('whenDomReady is %O', whenDomReady) workaround for
// mixed module systems, when this is imported by es6 module
if (whenDomReady.default) whenDomReady = whenDomReady.default

class NavManager extends EventEmitter {
  constructor (options) {
    super()

    // default options
    this.state = {}
    this.skipInit = false // for testing in node.js
    this.customPath = undefined
    this.customhash = undefined
    this.pathPrefix = false // false=autodetect; should start with /
    Object.assign(this, options || {})

    if (!this.skipInit) this.queueUpInit()
    debug('constructor done')
  }

  /*
    Don't init immediately, so others can subscribe before we send out
    the initial batch of changes.  Also, wait for DOM, so they don't
    need to. Also, wait one more tick, in case they unnecessarily wait
    for the DOM before subscribing.

    ER, no, how about instead having a nav.emitCurrentState() which
    you can call after DOM loaded, if that's how you roll.  I want
    link available at the start.

    Well, for now, I'll let folks call nav.init() themselves.
  */
  async queueUpInit () {
    // if (typeof whenDomReady !== 'function') {
    // console.error('whenDomReady is actually %O', whenDomReady)
    await whenDomReady()
    this.domReady = true
    this.emit('dom-ready')
    debug('dom ready')
    await delay(1) // allow other dom-ready hooks to run, just in case
    this.init()
    debug('init  done')
    this.emit('ready', this) // maybe handy; now you can use 'link'
  }
  init (rootURL, thisURL) {
    if (this.ready) return // allow repeated inits
    
    window.addEventListener('popstate', (event) => {
      this.updateFromURL(document.location)
      // ignore event.state; we believe any state restored by the BACK
      // button should be in the URL.  Does that apply even to
      // scrollstate? Hmm, to be considered.
    })

    const onNav = this.onNav.bind(this)
    window.addEventListener('click', onNav)
    window.addEventListener('submit', onNav)

    if (!rootURL) {
      const rel = document.querySelector('link[rel="start"]')
      if (rel) {
        rootURL = (new URL(rel.getAttribute('href'), window.location.href)).href
      }
    }
    if (!rootURL) {
      rootURL = window.location.href
    }
    const parsed = new URL(rootURL)

    this.origin = parsed.origin
    if (!this.pathPrefix) {
      this.pathPrefix = parsed.pathname
    }

    if (!thisURL) thisURL = window.location.href
        // with file: URLs we simulate the path with a path parameter for dev
    if (thisURL.startsWith('file:')) {
      const parsed2 = new URL(thisURL)
      this.file = parsed2.protocol + parsed2.pathname
      this.origin = parsed2.origin
      this.pathPrefix = '/'
    }

    this.ready = true
    this.updateFromURL(thisURL)
    debug('init complete, this =', this)
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
    } else if (target.nodeName === 'FORM') {
      // This only makes sense for query forms -- data changing forms
      // are not navigation.
      if (!target.action || target.action === window.location.href) {
        event.preventDefault()
        return
      }
      // I believe this wipes out the state, so you'll need to encode
      // it into hidden fields or something. I'm not using forms at
      // the moment, so this part's not tested.
      href = target.action
    } else {
      return
    }

    // because we .open() external ones, we'll never want default
    event.preventDefault()

    const url = new URL(href)

    debug('.. its a link')

    let urlIsOurs = false
    if (url.origin === this.origin) {
      debug('.. same origin')
      if (url.pathname === this.pathPrefix) {
        debug('.. and its the URL we stated at')
        urlIsOurs = true
      } else {
        debug('THIS.CUSTOMPATH', this.customPath)
        if (decodeFromString(this.customPath, url.pathname)) {
          debug('.. and its acceptable to customPath.parse')
          urlIsOurs = true
        }
      }
    }
    if (urlIsOurs) {
      debug('.. pretending to nav to', href)
      window.history.pushState(null, null, href)
      this.updateFromURL(url)
    } else {
      window.open(href, '_blank')
    }
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
    // make copy, because encodeInString removes the properties it encodes
    if (report) report.newState = Object.assign({}, newState)

    // debug({newState})

    // encode it into a URL
    // debug('in link, file? ', this.file)
    const url = new URL(this.file ? this.file : this.origin)
    const sp = url.searchParams

    let path = encodeInString(this.customPath, newState) || '/'

    const hash = encodeInString(this.customHash, newState)
    if (hash) url.hash = hash

    // don't use encodeURIComponent because it's too aggressive sometimes
    // but also let's avoid the obvious security hole
    path = path.replace(/"/g, '%22').replace(/'/g, '%27')

    if (this.file) {
      if (path !== '/') newState.pathname = path
    } else {
      if (this.pathPrefix.endsWith('/')) path = path.slice(1)
      url.pathname = this.pathPrefix + path
      debug('concat pathPrefix %o and path %o to make pathname %o',
        this.pathPrefix, path, url.pathname)
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
      path = newState.pathname || '/'
      delete newState.pathname
    } else {
      if (path.startsWith(this.pathPrefix)) {
        path = path.slice(this.pathPrefix.length)
        // path prefix might end in / or not, we dont know
        if (!path.startsWith('/')) path = '/' + path
        debug('stripped prefix from path, leaving:', path)
      } else {
        console.error('app pathname %o doesnt start with app pathPrefix %o',
          path, this.pathPrefix)
      }
    }

    const stateFromPath = decodeFromString(this.customPath, path)
    if (stateFromPath === 'NotFound') {
      console.error('app running at pathname it isnt coded to understand', JSON.stringify(path))
    } else {
      Object.assign(newState, stateFromPath)
    }
    // bad hash in browsers should fail silently, I believe
    Object.assign(newState, decodeFromString(this.customHash, url.hash, {}))

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
        atEnd.push(() => {
          this.emit(`change-${key}`,
            { key, oldValue, newValue })
        })
      }
    }

    // modify values for any keys present in the new state
    for (const [key, newValue] of Object.entries(newState)) {
      const oldValue = this.state[key]
      debug('newstate has', key, newValue, oldValue, oldValue !== newValue)
      if (oldValue !== newValue) {
        this.state[key] = newValue
        atEnd.push(() => {
          this.emit(`change-${key}`,
            { key, oldValue, newValue })
        })
        changed = true
      }
    }

    if (changed) {
      atEnd.push(() => { this.emit(`change`, { newState, oldState }) })
      if (!shallowEqualObjects(newState, this.state)) {
        console.error('bug newState!=state', { url, oldState, newState, state: this.state })
      }
    } else {
      if (!shallowEqualObjects(this.state, oldState)) {
        console.error('bug oldState!=state when no change', { url, oldState, newState, state: this.state })
      }
    }
    debug('final state: %o', this.state)

    this.scanDataLinks()

    // save the emits for the end, because they might call nav.jump
    // which would land as back in this function, on a re-entrant
    // call, which isn't going to work well, since they're sharing
    // this.state and we have a promise to emit changes in the order
    // they happen.
    for (const f of atEnd) f()
  }

  scanDataLinks () {
    // Modify href fields set with data-link-to-state so they are
    // relative to the current state.  This is important for things
    // like folks copying the URL following it. We could use that
    // field ourselves, but let's avoid that error path by using
    // the href like everyone else.
    for (const elem of document.querySelectorAll('a[data-link-to-state]')) {
      // debug('elem', elem)
      let change = elem.getAttribute('data-link-to-state')
      // debug('change = ', change)
      try {
        change = eval(`( ${change} )`) // eslint-disable-line
      } catch (e) {
        console.error('nav-spa.scanDataLinks.eval: ', e)
        change = {}
      }
      // debug('change = ', change)
      const report = {}
      elem.setAttribute('href', this.link(change, report))
      debug('constructed link to state', report.newState)
      if (shallowEqualObjects(report.newState, this.state)) {
        debug(' .. which matches this.state', this.state)
        elem.classList.add('href-to-here')
        elem.classList.remove('href-to-away')
      } else {
        debug(' .. which DOES NOT match this.state', this.state)
        elem.classList.add('href-to-away')
        elem.classList.remove('href-to-here')
      }
    }
  }
}

function encodeInString (custom, state) {
  let out
  if (custom) {
    const { unparse, parse } = custom
    debug('encodeInString', { unparse, parse, state })
    out = unparse(state)
    if (out === undefined) return out
    const used = parse(out)
    for (const [key, value] of Object.entries(used)) {
      const oVal = state[key]
      if (oVal !== value) {
        console.error(`Error encoding state[${JSON.stringify(key)}], parse(unparse(${JSON.stringify(oVal)})) !== expected ${JSON.stringify(value)}`)
      }
      delete state[key]
    }
  }
  return out
}

// return {} if there's no custom handler, but return
// ifNotFound if custom handler can't handle this string
//
function decodeFromString (custom, str, ifNotFound = 'NotFound') {
  if (custom) {
    const { unparse, parse } = custom
    debug('decodeFromString', { unparse, parse, str })
    const state = parse(str)
    if (state === 'NotFound') return ifNotFound
    // just a check ourselves
    const str2 = encodeInString({ unparse, parse }, Object.assign({}, state))
    if (str !== str2) console.error(`nav-spa: decodeFromString loop check failed on ${JSON.stringify(str)} which produced state ${JSON.stringify(state)} which re-encoded as ${JSON.stringify(str2)}`)
    return state
  }
  return {}
}

// usually it's fine to just have the one instance
const nav = new NavManager()

module.exports = nav

/*
   for dev
window.dbg = () => { window.localStorage.setItem('debug', '*') }
window.ndbg = () => { window.localStorage.setItem('debug', '') }
window.nav = nav
*/
