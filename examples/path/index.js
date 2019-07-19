const { nav } = require('/home/sandro/Repos/nav-spa')

nav.on('change-color', ({key, oldValue, newValue}) => {
  console.log('Nav-state property %o changed value from %o to %o',
              key, oldValue, newValue)
  
  if (!newValue) newValue = 'white'
  document.getElementById('test').style.backgroundColor = newValue
  document.title = `Hello in ${newValue}`
})

nav.on('ready', () => {
  // just to help the demo be set up
  document.getElementById('erase-on-start').style.display = 'none'
})

nav.customPath = { parse, unparse }

function parse (path) {
  path = path.slice(1) // skip the leading slash
  if (path === '') return { }
  if (/^\w+$/.test(path)) return { color: path }
  return 'NotFound'
}

function unparse (state) {
  if (state.color) return '/' + state.color
  return '/'
}
