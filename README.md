# nav-state2 maybe nav-spa, hate-spa, hatespa
[![NPM version][npm-image]][npm-url]

Easy [HATEOAS](https://en.wikipedia.org/wiki/HATEOAS) for your
[SPA}(https://en.wikipedia.org/wiki/Single-page_application), because
URL state is nice and single page apps are nice, but they don't
naturally play together.  This little module might do the trick.
Alternatively, you could use something more established like
react-router-redux.

---

There are currently two examples provided.  The first is something like:

```js
const { nav } = require('nav-state2')

nav.on('change-color', ({key, oldValue, newValue}) => {
  console.log('Nav-state property %o changed value from %o to %o',
              key, oldValue, newValue)
  
  if (!newValue) newValue = 'white'
  document.getElementById('test').style.backgroundColor = newValue
  document.title = `Hello in ${newValue}`
})
```

The changes in this case are trigged by the HTML having bits like:

```html
      <a data-link-to-state="{color: 'green'}">green</a>
      <a data-link-to-state="{color: 'yellow'}">yellow</a>
```

This module looks for `data-link-to-state` attributes and adds the
right href to get us to that state.  You can get that URL manually
with `nav.link(...)` or go ahead and jump there, perhaps in an onclick
handler, with `nav.jump(...)`.

By default we store all the state in query parameters. You can provide
functions to map some state properties into the pathname and/or hash
if you want. If you store state in the pathname, your web server will
have to serve up this SPA for all those URLs (but still let your CSS
and JS files through).

Example 2 shows you can even change the url state at the browser frame rate.




[npm-image]: https://img.shields.io/npm/v/nav-state2.svg?style=flat-square
[npm-url]: https://npmjs.org/package/nav-state2
