const test = require('tape')
const my = require('.')

test(async (t) => {
  t.equal(await my.f(), 'expected output')
  t.end()           
})
