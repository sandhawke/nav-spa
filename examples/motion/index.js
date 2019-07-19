const { nav } = require('/home/sandro/Repos/nav-state')

nav.on('ready', () => {
  document.getElementById('erase-on-start').style.display = 'none'
})

nav.on('change', ({ newState: { angle, run } }) => {
  // console.log('CHANGE', {angle, run})
  angle = parseFloat(angle)
  if (angle === undefined || isNaN(angle)) angle = 0

  const width = document.body.clientWidth
  const r = width / 4
  const x = Math.round(Math.cos(angle) * r + (width/4))
  const y = Math.round(Math.sin(angle) * r + (width/4))

  const elem = document.getElementById('test')
  elem.style.left = `${x}px`
  elem.style.top = `${y}px`

  if (run) {
    window.requestAnimationFrame(() => {
      nav.jump({angle: angle + 0.02}, {noHistory: true})
    })
  }
})


