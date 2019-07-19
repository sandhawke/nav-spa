# nav-spa
[![NPM version][npm-image]][npm-url]

Makes URL navigation in your
[SPA](https://en.wikipedia.org/wiki/Single-page_application) look just
like classic [HATEOAS](https://en.wikipedia.org/wiki/HATEOAS)
websites, where the URL tells people what's going on. Every state (if
you want) can be bookmarked, shared, and even edited by hand in the
address bar.  We put things in the query string by default, but if you
provide mapping functions, state can also be encoded using the path
and/or hash.

Alternatives include more established options like react-router-redux,
or using architectures like service-workers to get SPA performance,
without actually being a SPA.

---

There are currently two examples provided.  The first is something like:

```js
const { nav } = require('nav-spa')

nav.on('change-color', ({key, oldValue, newValue}) => {
  console.log('Nav-state property %o changed value from %o to %o',
              key, oldValue, newValue)
  
  if (!newValue) newValue = 'white'
  document.getElementById('test').style.backgroundColor = newValue
  document.title = `Hello in ${newValue}`
})
```

The state-changing navigation in this case are trigged by the HTML
having bits like:

```html
      <a data-link-to-state="{color: 'green'}">green</a>
      <a data-link-to-state="{color: 'yellow'}">yellow</a>
```

This module looks for `data-link-to-state` attributes and adds the
right href to get us to that state.  You can get that URL manually
with `nav.link(...)` or go ahead and jump there, perhaps in an onclick
handler, with `nav.jump(...)`.

example/motion shows you can even change the url state at the browser
frame rate. Seems to work okay. In that case we don't put ever state
in the browser history.

## Custom Paths

By default we store all the state in query parameters. You can (and
probable should) provide functions to map some state properties into
the pathname (and/or hash).

If you store state in the pathname, your web server will have to serve
up this SPA for all those URLs (but still let your CSS and JS files
through).

examples/path shows a path version of examples/color

The difference is this added code:

```js
nav.customPath = { parse, unparse }

function parse (path) {
  path = path.slice(1) // skip the leading slash
  if (/^\w+$/.test(path)) return { color: path }
  return 'NotFound'
}

function unparse (state) {
  if (state.color) return '/' + state.color
  return undefined
}
```

Your parse function takes a path and return an object like { prop:
value } with whatever state it gleaned. It returns the magic string
'NotFound' if it can't deal with this.  In practice that's used to
limit what URLs we intercerpt clicks on.

Your unparse function takes a state object like parse produces a
string which encodes some or all of that state.

This module automatically detects when state is encoded in a string
and then skips encoding it in the query parameters. (It does this by
calling your parse function on the string to see what state it will be
able to extract.)


[npm-image]: https://img.shields.io/npm/v/nav-spa.svg?style=flat-square
[npm-url]: https://npmjs.org/package/nav-spa
