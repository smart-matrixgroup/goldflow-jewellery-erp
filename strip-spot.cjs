const fs = require('fs')
const path = 'C:/Users/kavit/Desktop/jewellery/apps/erp/src/theme.css'
let source = fs.readFileSync(path, 'utf8')
const card = '170px circle at var(--mx, 50%) var(--my, 20%), rgba(255, 246, 214, 0.55), transparent 68%'
const tile = '140px circle at var(--mx, 50%) var(--my, 30%), rgba(255, 246, 214, 0.7), transparent 70%'
if (!source.includes(card)) throw new Error('card spotlight missing')
if (!source.includes(tile)) throw new Error('tile spotlight missing')
source = source.replace(card, '0px circle at 50% 50%, transparent, transparent')
source = source.replace(tile, '0px circle at 50% 50%, transparent, transparent')
fs.writeFileSync(path, source)
console.log('spotlights cleared')
