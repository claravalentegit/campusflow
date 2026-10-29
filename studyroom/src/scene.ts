/**
 * The room behind the characters: a calm cartoon room with lots of open floor.
 * The window follows the real time of day (morning, day, sunset, night).
 */

export type Sky = 'morning' | 'day' | 'sunset' | 'night'

export function skyFor(date: Date): Sky {
  const h = date.getHours() + date.getMinutes() / 60
  if (h >= 6 && h < 9) return 'morning'
  if (h >= 9 && h < 17) return 'day'
  if (h >= 17 && h < 20) return 'sunset'
  return 'night'
}

const SKIES: Record<Sky, { top: string; mid: string; bottom: string; wall: [string, string]; glow: number }> = {
  morning: { top: '#8ec5ff', mid: '#ffd1dc', bottom: '#ffe9b8', wall: ['#f7d9c4', '#efc4a8'], glow: 0.15 },
  day: { top: '#5fb4ff', mid: '#9fd4ff', bottom: '#d9f0ff', wall: ['#f6dcc8', '#eec7ab'], glow: 0.1 },
  sunset: { top: '#6a5acd', mid: '#e67fa6', bottom: '#ffb37a', wall: ['#f3c3a6', '#e7a989'], glow: 0.35 },
  night: { top: '#1f2457', mid: '#3d3a7a', bottom: '#6b4f8f', wall: ['#cfa7a4', '#b98f93'], glow: 0.55 },
}

export function sceneSvg(sky: Sky): string {
  const s = SKIES[sky]
  const night = sky === 'night'
  const stars = night
    ? [[680, 120], [760, 90], [840, 150], [900, 110], [720, 200], [960, 180], [800, 230], [650, 180]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i % 3 ? 2 : 3}" fill="#fff" class="twinkle" style="animation-delay:${i * 0.4}s"/>`).join('')
    : ''
  const orb =
    sky === 'night'
      ? '<circle cx="900" cy="150" r="34" fill="#fff4cf"/><circle cx="914" cy="140" r="30" fill="#3d3a7a" opacity=".0"/>'
      : sky === 'sunset'
        ? '<circle cx="880" cy="300" r="48" fill="#ffd57a" opacity=".95"/>'
        : `<circle cx="${sky === 'morning' ? 690 : 880}" cy="${sky === 'morning' ? 260 : 150}" r="40" fill="#fff3b0"/>`
  const clouds =
    sky === 'day' || sky === 'morning'
      ? '<g fill="#fff" opacity=".9" class="drift"><ellipse cx="700" cy="170" rx="50" ry="18"/><ellipse cx="735" cy="158" rx="34" ry="18"/></g><g fill="#fff" opacity=".75" class="drift slow"><ellipse cx="860" cy="250" rx="44" ry="15"/><ellipse cx="888" cy="240" rx="26" ry="14"/></g>'
      : ''
  const lightAlpha = s.glow
  return `<svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s.wall[0]}"/><stop offset="1" stop-color="${s.wall[1]}"/></linearGradient>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s.top}"/><stop offset=".6" stop-color="${s.mid}"/><stop offset="1" stop-color="${s.bottom}"/></linearGradient>
    <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c98a5a"/><stop offset="1" stop-color="#a86a40"/></linearGradient>
    <radialGradient id="lamp"><stop offset="0" stop-color="#ffe3a0" stop-opacity="${0.35 + lightAlpha * 0.6}"/><stop offset="1" stop-color="#ffe3a0" stop-opacity="0"/></radialGradient>
    <radialGradient id="bulb"><stop offset="0" stop-color="#fff1b8" stop-opacity="${0.4 + lightAlpha}"/><stop offset="1" stop-color="#fff1b8" stop-opacity="0"/></radialGradient>
    <linearGradient id="beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6d8" stop-opacity="${night ? 0.1 : 0.28}"/><stop offset="1" stop-color="#fff6d8" stop-opacity="0"/></linearGradient>
    <pattern id="paper" width="40" height="40" patternUnits="userSpaceOnUse"><circle cx="20" cy="20" r="2.5" fill="#fff" opacity=".22"/></pattern>
    <radialGradient id="vignette" cx=".5" cy=".42" r=".8"><stop offset=".55" stop-color="#2a1424" stop-opacity="0"/><stop offset="1" stop-color="#2a1424" stop-opacity="${0.25 + lightAlpha * 0.3}"/></radialGradient>
  </defs>

  <rect width="1600" height="640" fill="url(#wall)"/>
  <rect width="1600" height="640" fill="url(#paper)"/>

  <!-- wainscot -->
  <rect y="500" width="1600" height="140" fill="#000" opacity=".06"/>
  <rect y="494" width="1600" height="10" rx="5" fill="#fff" opacity=".45"/>
  ${Array.from({ length: 16 }, (_, i) => `<rect x="${30 + i * 100}" y="522" width="76" height="96" rx="12" fill="#fff" opacity=".1"/>`).join('')}

  <!-- string lights -->
  <path d="M0 40 Q200 95 400 40 T800 40 T1200 40 T1600 40" stroke="#5a3a3a" stroke-width="3" fill="none" opacity=".55"/>
  ${Array.from({ length: 32 }, (_, i) => {
    const x = 25 + i * 50
    const t = (x % 400) / 400
    const y = 40 + 55 * 4 * t * (1 - t) * 0.5 + 6
    const c = ['#ffd36b', '#ff9eb5', '#9be3ff', '#b6f29a'][i % 4]
    return `<circle cx="${x}" cy="${y}" r="18" fill="url(#bulb)" class="twinkle" style="animation-delay:${(i % 5) * 0.5}s"/><circle cx="${x}" cy="${y}" r="6" fill="${c}"/>`
  }).join('')}

  <!-- big arched window -->
  <path d="M600 470 v-250 a200 200 0 0 1 400 0 v250z" fill="#fff6ec"/>
  <path d="M622 456 v-236 a178 178 0 0 1 356 0 v236z" fill="url(#sky)"/>
  ${stars}${orb}${clouds}
  <path d="M622 456 v-46 q60 -30 110 -6 q60 -34 120 -4 q70 -24 126 4 v52z" fill="${night ? '#2c2a5a' : '#8fbf8a'}" opacity=".9"/>
  <path d="M800 42 v414 M622 300 h356" stroke="#fff6ec" stroke-width="12"/>
  <rect x="580" y="456" width="440" height="24" rx="12" fill="#f0d6c0"/>
  <path d="M600 480 l-40 160 h480 l-40 -160z" fill="url(#beam)"/>
  <!-- sill plants -->
  <path d="M650 456 q-10 -50 6 -70 M662 456 q12 -46 34 -54 M656 456 q-26 -24 -30 -46" stroke="#5aa86a" stroke-width="9" fill="none" stroke-linecap="round"/>
  <rect x="632" y="430" width="50" height="30" rx="9" fill="#e98a6a"/>
  <circle cx="946" cy="426" r="20" fill="#7cc48a"/><circle cx="932" cy="434" r="14" fill="#5fae6f"/>
  <rect x="918" y="434" width="50" height="26" rx="9" fill="#f2c14e"/>

  <!-- curtains -->
  <path d="M560 34 q32 200 0 430 h44 q26 -215 0 -430z" fill="#f7e2c2"/>
  <path d="M1040 34 q-32 200 0 430 h-44 q-26 -215 0 -430z" fill="#f7e2c2"/>
  <rect x="540" y="26" width="520" height="14" rx="7" fill="#9a6a52"/>

  <!-- left: bookshelf -->
  <g transform="translate(110 250)">
    <rect width="190" height="390" rx="14" fill="#a8693f"/>
    <rect x="12" y="12" width="166" height="366" rx="8" fill="#7d4a2c"/>
    ${[0, 1, 2].map((r) => `<rect x="12" y="${118 + r * 122}" width="166" height="10" fill="#a8693f"/>`).join('')}
    ${[
      [24, 50, 18, '#ef6b6b'], [44, 40, 14, '#5b8def'], [60, 56, 20, '#f5c451'], [82, 44, 14, '#79c487'],
      [26, 172, 16, '#b18cf2'], [44, 166, 18, '#ef8fb5'], [64, 178, 14, '#5bc6e8'],
      [120, 300, 18, '#f5c451'], [140, 290, 16, '#ef6b6b'], [158, 304, 14, '#5b8def'],
    ].map(([x, y, w, c]) => `<rect x="${x}" y="${y}" width="${w}" height="${(Math.floor(((y as number) - 12) / 122) + 1) * 122 - 4 - (y as number)}" rx="3" fill="${c}"/>`).join('')}
    <circle cx="140" cy="96" r="20" fill="#7cc48a"/><rect x="122" y="96" width="36" height="22" rx="6" fill="#e98a6a"/>
    <rect x="110" y="196" width="50" height="44" rx="6" fill="#fff6ec"/><rect x="116" y="202" width="38" height="28" rx="3" fill="#9be3ff"/>
  </g>

  <!-- hanging plant -->
  <path d="M400 0 v120" stroke="#8a5a4a" stroke-width="3"/>
  <path d="M370 120 h60 l-10 40 h-40z" fill="#e98a6a"/>
  <path d="M384 160 q-16 60 -4 120 M400 160 q6 70 -2 130 M416 160 q18 50 8 100" stroke="#5fae6f" stroke-width="8" fill="none" stroke-linecap="round" class="sway"/>

  <!-- right: frames + floor lamp -->
  <rect x="1160" y="170" width="120" height="90" rx="10" fill="#fff6ec"/><rect x="1172" y="182" width="96" height="66" rx="6" fill="#ffd1a6"/><path d="M1172 248 l30 -30 l22 18 l18 -12 l26 24z" fill="#79c487"/>
  <rect x="1300" y="210" width="70" height="90" rx="10" fill="#fff6ec"/><circle cx="1335" cy="250" r="20" fill="#b18cf2"/>
  <circle cx="1440" cy="300" r="190" fill="url(#lamp)"/>
  <path d="M1400 300 h80 l-18 -64 h-44z" fill="#ffd36b"/>
  <rect x="1436" y="300" width="8" height="330" fill="#8a5a4a"/>
  <ellipse cx="1440" cy="636" rx="44" ry="10" fill="#8a5a4a"/>

  <!-- floor -->
  <rect y="640" width="1600" height="260" fill="url(#floor)"/>
  ${Array.from({ length: 7 }, (_, r) => `<path d="M0 ${670 + r * 36} H1600" stroke="#8f5432" stroke-width="2" opacity=".35"/>`).join('')}
  ${Array.from({ length: 7 }, (_, r) => Array.from({ length: 8 }, (_, i) => `<path d="M${((r * 137) % 230) + i * 230} ${640 + r * 36} v36" stroke="#8f5432" stroke-width="2" opacity=".3"/>`).join('')).join('')}
  <rect y="636" width="1600" height="10" fill="#7a4428" opacity=".5"/>
  <ellipse cx="800" cy="760" rx="520" ry="66" fill="#d9607a" opacity=".9"/>
  <ellipse cx="800" cy="760" rx="480" ry="54" fill="#ea7f93" opacity=".9"/>
  <ellipse cx="800" cy="760" rx="420" ry="40" fill="none" stroke="#fff3e0" stroke-width="5" stroke-dasharray="16 12" opacity=".7"/>

  <rect width="1600" height="900" fill="url(#vignette)"/>
</svg>`
}
