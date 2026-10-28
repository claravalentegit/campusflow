// Turns the `vite build --mode single` output into one self-contained HTML body fragment
// (inline CSS + JS), for hosts that only accept a single file.
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const dir = 'dist-single'
let html = readFileSync(join(dir, 'index.html'), 'utf8')
const read = (href) => readFileSync(join(dir, href.replace(/^\//, '')), 'utf8')
let css = ''
let js = ''
html = html.replace(/<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g, (_, href) => ((css += read(href)), ''))
html = html.replace(/<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/g, (_, src) => ((js += read(src)), ''))
const fonts = html.match(/<link[^>]+fonts\.googleapis\.com\/css2[^>]+>/)?.[0] ?? ''
const themeScript = html.match(/<script>\s*\/\/ Apply the saved theme[\s\S]*?<\/script>/)?.[0] ?? ''
const out = `<title>CampusFlow</title>
${themeScript}
<meta name="theme-color" content="#4f46e5">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
${fonts}
<style>
${css}
</style>
<div id="root"></div>
<script type="module">
${js.replace(/<\/script/gi, '<\\/script')}
</script>
`
writeFileSync(join(dir, 'campusflow.html'), out)
console.log(`campusflow.html: ${(out.length / 1024).toFixed(0)} KB`)
