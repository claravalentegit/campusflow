// Builds one self-contained HTML file (inline CSS + JS) for previewing Study Room inside Claude.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const dir = 'dist'
const html = readFileSync(join(dir, 'index.html'), 'utf8')
const read = (href) => readFileSync(join(dir, href.replace(/^\//, '')), 'utf8')
let css = ''
let js = ''
html.replace(/<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g, (_, href) => (css += read(href)))
html.replace(/<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/g, (_, src) => (js += read(src)))
const out = `<title>Study Room</title>
<meta name="theme-color" content="#3a2530">
<style>
${css}
</style>
<main id="app"></main>
<script type="module">
${js.replace(/<\/script/gi, '<\\/script')}
</script>
`
writeFileSync('study-room-preview.html', out)
console.log(`study-room-preview.html: ${(out.length / 1024).toFixed(0)} KB`, readdirSync(join(dir, 'assets')))
