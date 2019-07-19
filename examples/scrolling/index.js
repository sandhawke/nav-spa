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
