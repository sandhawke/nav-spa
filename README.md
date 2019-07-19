# nav-state
[![NPM version][npm-image]][npm-url]

Easy HATEOAS for your SPA

---

```js
const { nav } = require('nav-state')

nav.on('change-color', ({key, oldValue, newValue}) => {
  document.getElementById('test').setAttribute(color, newValue)
})

nav.on('ready', () => {
  document.body.innerHTML = `
  <div id="test">Hello</div>
  <a href="">red</a>
  <a href="">blue</a>
  <button onclick="">green</button>
})
[npm-image]: https://img.shields.io/npm/v/nav-state.svg?style=flat-square
[npm-url]: https://npmjs.org/package/nav-state
