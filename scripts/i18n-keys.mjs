// Lists every English phrase the student app translates: t('…'), tt('…'), tr('…'), msg('…'),
// and plain-text label/hint/placeholder/title/description props (translated by the UI components).
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const SKIP = /(^|\/)(parent|i18n|test)(\/|$)|\.test\.tsx?$/
const CALL = /\b(?:t|tt|tr|msg)\(\s*'((?:[^'\\]|\\.)*)'/g
const PROP = /\b(?:label|hint|placeholder|title|description)="([^"{}]*[A-Za-z][^"{}]*)"/g

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.tsx?$/.test(name) && !SKIP.test(p.replace(/\\/g, '/').replace(/^.*?src\//, ''))) out.push(p)
  }
  return out
}

export function i18nKeys(root) {
  const keys = new Map()
  for (const file of walk(join(root, 'src'))) {
    const src = readFileSync(file, 'utf8')
    for (const re of [CALL, PROP]) for (const m of src.matchAll(re)) if (/[A-Za-z]/.test(m[1])) keys.set(m[1].replace(/\\'/g, "'"), file)
  }
  return keys
}

if (process.argv[1]?.endsWith('i18n-keys.mjs')) {
  const keys = i18nKeys(process.cwd())
  console.log(JSON.stringify([...keys.keys()].sort(), null, 1))
}
