const { nav } = require('/home/sandro/Repos/nav-spa')

let angle = 0

nav.on('ready', () => {
  document.getElementById('erase-on-start').style.display = 'none'
  move()
})

function move () {
  angle += 0.02
  const width = document.body.clientWidth
  const r = width / 4
  const x = Math.round(Math.cos(angle) * r + (width/4))
  const y = Math.round(Math.sin(angle) * r + (width/4))

  const elem = document.getElementById('test')
  elem.style.left = `${x}px`
  elem.style.top = `${y}px`
  
  window.requestAnimationFrame(move)
}
