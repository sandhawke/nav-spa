const { shallowEqualObjects } = require('shallow-equal')

x = { angle: 4.71 }
y = { }

console.log(shallowEqualObjects(x, y))
console.log(!shallowEqualObjects(x, y))
