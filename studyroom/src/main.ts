import './styles.css'
import {
  advance, BREAK_MINUTES, clampMinutes, EMOJIS, type Emoji, formatClock, formatDuration, HAT_NAMES, HAT_UNLOCK_MINUTES, IDLE,
  type Look, pause, PRESETS, type PublicMember, resume, type RoomState, secondsLeft, start, type Status, type Timer,
} from '../shared/model.ts'
import { HAIR_STYLES, spriteUrl, SWATCHES } from './sprites.ts'
import { sceneSvg, skyFor } from './scene.ts'
import { setSound, sfx } from './sound.ts'

// ——— Saved on this device ———

const store = {
  get<T>(k: string, fallback: T): T {
    try {
      const v = localStorage.getItem(`studyroom:${k}`)
      return v == null ? fallback : (JSON.parse(v) as T)
    } catch {
      return fallback
    }
  },
  set(k: string, v: unknown) {
    try {
      localStorage.setItem(`studyroom:${k}`, JSON.stringify(v))
    } catch {
      /* private mode: fine, just not remembered */
    }
  },
}

function randomKey(): string {
  const b = new Uint8Array(24)
  crypto.getRandomValues(b)
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const rand = (n: number) => Math.floor(Math.random() * n)
const randomLook = (): Look => ({ skin: rand(5), hair: rand(4), hairColor: rand(5), shirt: rand(7), pants: rand(4), hat: 0 })

const me = {
  key: store.get('key', '') || randomKey(),
  name: store.get('name', ''),
  look: store.get<Look>('look', randomLook()),
}
store.set('key', me.key)
let totalStudied = store.get('studied', 0) // seconds, for unlocking hats
let presetId = store.get('preset', PRESETS[0].id)
let custom = store.get('custom', { study: 30, rest: 5 })
let soundOn = store.get('sound', true)
setSound(soundOn)

const preset = () => (presetId === 'custom' ? { id: 'custom', label: 'Custom', ...custom } : PRESETS.find((p) => p.id === presetId) ?? PRESETS[0])
const hatUnlocked = (i: number) => totalStudied / 60 >= HAT_UNLOCK_MINUTES[i]
if (!hatUnlocked(me.look.hat)) me.look.hat = 0

// ——— App state ———

type Mode = 'home' | 'solo' | 'room'
let mode: Mode = 'home'
let timer: Timer = IDLE
let room: { code: string; id: string; state: RoomState | null; offset: number; es: EventSource | null; seenCheer: number } | null = null
let cheerTarget: string | null = null

// ——— Small DOM helpers ———

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector(sel) as T
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

function toast(msg: string) {
  const el = document.createElement('div')
  el.className = 'toast'
  el.textContent = msg
  $('#toasts').append(el)
  setTimeout(() => el.classList.add('out'), 2600)
  setTimeout(() => el.remove(), 3000)
}

async function api<T>(path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api/rooms${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json', 'X-Study-Room': '1' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new Error('Rooms need the Study Room website. Here you can try “Study alone”.')
  }
  if (!(res.headers.get('content-type') ?? '').includes('application/json')) throw new Error('Rooms need the Study Room website. Here you can try “Study alone”.')
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { message?: string }).message ?? 'Something went wrong.')
  return data as T
}

// ——— Layout ———

document.querySelector('#app')!.innerHTML = `
  <div class="scene" id="scene"></div>
  <div class="people" id="people"></div>
  <header class="top" id="top"></header>
  <div class="cheer-pop" id="cheer-pop" hidden></div>
  <section class="home" id="home"></section>
  <footer class="hud" id="hud" hidden></footer>
  <div class="toasts" id="toasts" aria-live="polite"></div>`

function paintScene() {
  $('#scene').innerHTML = sceneSvg(skyFor(new Date()))
}
paintScene()
setInterval(paintScene, 5 * 60_000)

// ——— Home: make your character, then study alone or with friends ———

const inviteCode = new URLSearchParams(location.search).get('room')?.toUpperCase() ?? ''

function swatchRow(label: string, key: keyof Look, colors: string[]) {
  return `<div class="row"><span class="lbl">${label}</span><div class="swatches">${colors
    .map((c, i) => `<button type="button" class="sw ${me.look[key] === i ? 'on' : ''}" style="--c:${c}" data-look="${key}" data-v="${i}" aria-label="${label} ${i + 1}" aria-pressed="${me.look[key] === i}"></button>`)
    .join('')}</div></div>`
}

function renderHome() {
  const home = $('#home')
  home.hidden = mode !== 'home'
  if (mode !== 'home') return
  home.innerHTML = `
    <div class="card">
      <h1>Study Room</h1>
      <p class="sub">Study with friends in a cozy room. Everyone sees each other, no chat, just focus.</p>
      <div class="maker">
        <div class="preview">
          <img src="${spriteUrl(me.look, 'idle')}" alt="Your character" class="sprite big bob" />
          <button type="button" class="ghost" id="dice">🎲 Surprise me</button>
        </div>
        <div class="opts">
          ${swatchRow('Skin', 'skin', SWATCHES.skin)}
          <div class="row"><span class="lbl">Hair</span><div class="chips">${HAIR_STYLES.map((h, i) => `<button type="button" class="chip ${me.look.hair === i ? 'on' : ''}" data-look="hair" data-v="${i}">${h[0].toUpperCase() + h.slice(1)}</button>`).join('')}</div></div>
          ${swatchRow('Hair color', 'hairColor', SWATCHES.hairColor)}
          ${swatchRow('Shirt', 'shirt', SWATCHES.shirt)}
          ${swatchRow('Pants', 'pants', SWATCHES.pants)}
          <div class="row"><span class="lbl">Hat</span><div class="chips">${HAT_NAMES.map((h, i) => {
            const ok = hatUnlocked(i)
            return `<button type="button" class="chip ${me.look.hat === i ? 'on' : ''}" data-look="hat" data-v="${i}" ${ok ? '' : 'disabled'} title="${ok ? h : `Study ${formatDuration(HAT_UNLOCK_MINUTES[i] * 60)} to unlock`}">${ok ? h : `🔒 ${formatDuration(HAT_UNLOCK_MINUTES[i] * 60)}`}</button>`
          }).join('')}</div></div>
        </div>
      </div>
      <label class="name">Your name <input id="name" maxlength="16" placeholder="First name or nickname" value="${esc(me.name)}" autocomplete="off" /></label>
      ${inviteCode ? `<button type="button" class="btn purple wide" id="join-invite">Join ${esc(inviteCode)}</button>` : ''}
      <div class="actions">
        <button type="button" class="btn ${inviteCode ? 'ghost' : 'purple'}" id="solo">🧍 Study alone</button>
        <button type="button" class="btn green" id="make">➕ Make a room</button>
      </div>
      <form class="join" id="join-form"><input id="code" placeholder="Friend’s code, like MAPLE-42" autocomplete="off" /><button class="btn yellow" type="submit">Join</button></form>
      <p class="fine">Rooms only show first names and characters. Nothing else about you is shared.</p>
    </div>`
}

$('#home').addEventListener('click', (e) => {
  const t = (e.target as HTMLElement).closest('button')
  if (!t) return
  if (t.dataset.look) {
    me.look = { ...me.look, [t.dataset.look]: Number(t.dataset.v) }
    store.set('look', me.look)
    sfx.pick()
    return updateMaker()
  }
  if (t.id === 'dice') {
    me.look = { ...randomLook(), hat: me.look.hat }
    store.set('look', me.look)
    sfx.pick()
    return updateMaker()
  }
  if (t.id === 'solo') return enter('solo')
  if (t.id === 'make') return void makeRoom()
  if (t.id === 'join-invite') return void joinRoom(inviteCode)
})
/** Picking a feature only swaps the picture and the selected buttons, so nothing flashes. */
function updateMaker() {
  const img = $<HTMLImageElement>('#home .preview .sprite')
  if (img) {
    img.src = spriteUrl(me.look, 'idle')
    img.classList.remove('picked')
    void img.offsetWidth
    img.classList.add('picked')
  }
  for (const b of document.querySelectorAll<HTMLButtonElement>('#home [data-look]')) {
    const on = me.look[b.dataset.look as keyof Look] === Number(b.dataset.v)
    b.classList.toggle('on', on)
    b.setAttribute('aria-pressed', String(on))
  }
}

$('#home').addEventListener('input', (e) => {
  if ((e.target as HTMLElement).id === 'name') {
    me.name = (e.target as HTMLInputElement).value
    store.set('name', me.name)
  }
})
$('#home').addEventListener('submit', (e) => {
  e.preventDefault()
  void joinRoom(($('#code') as HTMLInputElement).value)
})

function needName(): boolean {
  if (me.name.trim()) return false
  toast('Type your name first 🙂')
  ;($('#name') as HTMLInputElement | null)?.focus()
  return true
}

function enter(m: Mode) {
  if (needName()) return
  mode = m
  sfx.join()
  window.addEventListener('resize', () => renderPeople())

render()
}

// ——— Rooms ———

async function makeRoom() {
  if (needName()) return
  try {
    const { code } = await api<{ code: string }>('', {})
    await joinRoom(code)
  } catch (e) {
    toast((e as Error).message)
  }
}

async function joinRoom(raw: string) {
  if (needName()) return
  const code = raw.trim().toUpperCase().replace(/\s+/g, '-')
  if (!/^[A-Z]{3,8}-\d{2}$/.test(code)) return toast('Room codes look like MAPLE-42.')
  try {
    const res = await api<{ id: string; state: RoomState }>(`/${code}/join`, { key: me.key, name: me.name.trim(), look: me.look, timer, clientNow: Date.now() })
    room?.es?.close()
    room = { code, id: res.id, state: res.state, offset: res.state.serverNow - Date.now(), es: null, seenCheer: Math.max(0, ...res.state.cheers.map((c) => c.id)) }
    history.replaceState(null, '', `?room=${code}`)
    listen()
    mode = 'room'
    sfx.join()
    render()
  } catch (e) {
    toast((e as Error).message)
  }
}

function listen() {
  if (!room) return
  const es = new EventSource(`/api/rooms/${room.code}/events`)
  room.es = es
  es.onmessage = (ev) => {
    if (!room) return
    const s = JSON.parse(ev.data) as RoomState
    const before = new Set(room.state?.members.map((m) => m.id))
    room.state = s
    room.offset = s.serverNow - Date.now()
    if (!s.members.some((m) => m.id === room!.id)) {
      // We were dropped (tab asleep too long): quietly rejoin.
      void api(`/${room.code}/join`, { key: me.key, name: me.name.trim(), look: me.look, timer, clientNow: Date.now() }).catch(() => {})
    }
    for (const m of s.members) if (before.size && !before.has(m.id) && m.id !== room.id) toast(`${m.name} joined 👋`)
    for (const c of s.cheers) {
      if (c.id <= room.seenCheer) continue
      room.seenCheer = c.id
      showCheer(c.to, c.emoji, s.members.find((m) => m.id === c.from)?.name ?? 'Someone')
    }
    renderPeople()
    renderTop()
  }
}

function pushTimer() {
  if (mode !== 'room' || !room) return
  void api(`/${room.code}/update`, { key: me.key, timer, clientNow: Date.now() }).catch(() => {})
}

async function leaveRoom() {
  if (room) {
    room.es?.close()
    void api(`/${room.code}/leave`, { key: me.key }).catch(() => {})
  }
  room = null
  history.replaceState(null, '', location.pathname)
  mode = 'home'
  sfx.leave()
  render()
}

// Heartbeat so friends know you're still here; leaving the tab tells the room too.
setInterval(() => {
  if (mode === 'room' && room) void api(`/${room.code}/update`, { key: me.key, clientNow: Date.now() }).catch(() => {})
}, 25_000)
window.addEventListener('pagehide', () => {
  if (mode === 'room' && room) navigator.sendBeacon?.(`/api/rooms/${room.code}/leave`, new Blob([JSON.stringify({ key: me.key })], { type: 'application/json' }))
})

// ——— Timer ———

function setTimer(t: Timer, sound: () => void = sfx.start) {
  timer = t
  sound()
  pushTimer()
  render()
}

let lastTick = Date.now()
function tick() {
  const now = Date.now()
  if (timer.status === 'study' && timer.pausedLeft == null && timer.endsAt) {
    totalStudied += Math.max(0, Math.min(now, timer.endsAt) - lastTick) / 1000
    if (Math.floor(totalStudied) % 10 === 0) store.set('studied', Math.floor(totalStudied))
  }
  lastTick = now
  const next = advance(timer, now, preset().rest)
  if (next) {
    const wasStudy = timer.status === 'study'
    timer = next
    sfx.chime()
    toast(wasStudy ? 'Study time done! Time to rest 😌' : 'Rest is over. Ready when you are!')
    store.set('studied', Math.floor(totalStudied))
    pushTimer()
    render()
  }
  updateClocks(now)
}
setInterval(tick, 250)

function memberTimer(m: PublicMember): Timer {
  return room && m.id === room.id ? timer : m.timer
}
function memberLeft(m: PublicMember, now: number): number {
  if (room && m.id === room.id) return secondsLeft(timer, now)
  return secondsLeft(m.timer, now + (room?.offset ?? 0))
}

function updateClocks(now: number) {
  for (const el of document.querySelectorAll<HTMLElement>('[data-clock]')) {
    const id = el.dataset.clock!
    const m = people().find((p) => p.id === id)
    if (!m) continue
    const t = memberTimer(m)
    const html = clockLine(t, memberLeft(m, now))
    if (el.innerHTML !== html) el.innerHTML = html
  }
  const left = secondsLeft(timer, now)
  const big = $('#big-clock')
  if (big) big.textContent = timer.status === 'idle' ? formatClock(preset().study * 60) : formatClock(left)
  document.title = timer.status === 'idle' ? 'Study Room' : `${formatClock(left)} · ${LABEL[timer.status].text} · Study Room`
  const goal = $('#goal-fill')
  if (goal && room?.state) goal.style.width = `${Math.min(100, (room.state.studied / room.state.goal) * 100)}%`
}

const LABEL: Record<Status, { icon: string; text: string; color: string }> = {
  idle: { icon: '✨', text: 'Ready', color: '#9a8aa8' },
  study: { icon: '📚', text: 'Studying', color: '#7c5cff' },
  rest: { icon: '😌', text: 'Resting', color: '#4fae7c' },
  break: { icon: '🥤', text: 'Break', color: '#e8a33a' },
}

/** Bubble text. The extra words are hidden on small screens so bubbles stay short. */
function clockLine(t: Timer, left: number): string {
  if (t.status === 'idle') return 'ready'
  if (t.pausedLeft != null) return `<i>paused · </i>${formatClock(left)}`
  return t.status === 'break' ? `<i>back in </i>${formatClock(left)}` : `${formatClock(left)}<i> left</i>`
}

// ——— People in the room ———

function people(): PublicMember[] {
  if (mode === 'room' && room?.state) return room.state.members
  return [{ id: 'me', name: me.name.trim() || 'You', look: me.look, timer, studied: 0 }]
}

const blinking = new Set<string>()

function renderPeople() {
  const list = people()
  const box = $('#people')
  const ids = new Set(list.map((m) => m.id))
  for (const el of [...box.children] as HTMLElement[]) if (!ids.has(el.dataset.id!)) el.remove()
  // Everyone in one row when possible; on phones busy rooms get smaller characters. A very full
  // room gets a second row further back.
  const phone = innerWidth < 700
  box.classList.toggle('tight', phone && list.length > 4)
  const perRow = phone ? 8 : Math.max(4, Math.min(10, Math.floor(innerWidth / 140)))
  const rows = Math.min(3, Math.ceil(list.length / perRow))
  const inRow = Math.ceil(list.length / rows)
  list.forEach((m, i) => {
    const mine = m.id === 'me' || m.id === room?.id
    const t = memberTimer(m)
    const status = t.status
    const row = Math.floor(i / inRow)
    const slot = i % inRow
    const count = Math.min(inRow, list.length - row * inRow)
    const x = ((slot + 1 + (row % 2 ? 0.5 : 0)) / (count + 1 + (row % 2 ? 0.5 : 0))) * 100
    let el = box.querySelector<HTMLElement>(`[data-id="${CSS.escape(m.id)}"]`)
    if (!el) {
      el = document.createElement('div')
      el.className = 'who enter'
      el.dataset.id = m.id
      el.innerHTML = `<div class="bubble"><b></b><span></span></div><button type="button" class="body" aria-label=""><img class="sprite" alt="" /><i class="z" hidden>z<small>z</small></i></button><div class="shadow"></div><div class="tag"></div>`
      box.append(el)
      setTimeout(() => el!.classList.remove('enter'), 600)
    }
    el.style.left = `${x}%`
    el.style.setProperty('--row', String(row))
    el.style.zIndex = String(10 - row)
    el.classList.toggle('mine', mine)
    el.dataset.status = status
    const L = LABEL[status]
    const bubble = el.querySelector<HTMLElement>('.bubble')!
    bubble.style.setProperty('--c', L.color)
    bubble.querySelector('b')!.innerHTML = `${L.icon}<i> ${L.text}</i>`
    const clock = bubble.querySelector<HTMLElement>('span')!
    clock.dataset.clock = m.id
    const line = clockLine(t, memberLeft(m, Date.now()))
    if (clock.innerHTML !== line) clock.innerHTML = line
    const img = el.querySelector<HTMLImageElement>('img')!
    const src = spriteUrl(m.look, status, blinking.has(m.id))
    if (img.getAttribute('src') !== src) img.src = src
    el.querySelector<HTMLElement>('.z')!.hidden = status !== 'rest'
    el.querySelector('.tag')!.textContent = mine ? `${m.name} (you)` : m.name
    el.querySelector<HTMLButtonElement>('.body')!.setAttribute('aria-label', mine ? `You, ${L.text}` : `Cheer for ${m.name}`)
  })
}

// Everyone blinks now and then.
setInterval(() => {
  const list = people()
  if (!list.length) return
  const m = list[rand(list.length)]
  blinking.add(m.id)
  renderPeople()
  setTimeout(() => {
    blinking.delete(m.id)
    renderPeople()
  }, 160)
}, 1400)

// Tap a friend to cheer them on.
$('#people').addEventListener('click', (e) => {
  const who = (e.target as HTMLElement).closest<HTMLElement>('.who')
  if (!who) return
  const id = who.dataset.id!
  if (id === 'me' || id === room?.id) {
    hop(who)
    sfx.pick()
    return
  }
  cheerTarget = id
  const pop = $('#cheer-pop')
  const r = who.getBoundingClientRect()
  pop.innerHTML = EMOJIS.map((em) => `<button type="button" data-emoji="${em}" aria-label="Send ${em}">${em}</button>`).join('')
  pop.style.left = `${r.left + r.width / 2}px`
  pop.style.top = `${r.top + 40}px`
  pop.hidden = false
  sfx.click()
})
$('#cheer-pop').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-emoji]')
  if (!b || !room || !cheerTarget) return
  const emoji = b.dataset.emoji as Emoji
  $('#cheer-pop').hidden = true
  void api(`/${room.code}/cheer`, { key: me.key, to: cheerTarget, emoji }).catch((err) => toast((err as Error).message))
})
document.addEventListener('pointerdown', (e) => {
  if (!(e.target as HTMLElement).closest('#cheer-pop, .who')) $('#cheer-pop').hidden = true
})

function hop(el: Element) {
  el.classList.remove('hop')
  void (el as HTMLElement).offsetWidth
  el.classList.add('hop')
}

function showCheer(to: string, emoji: string, from: string) {
  const el = $('#people').querySelector<HTMLElement>(`[data-id="${CSS.escape(to)}"]`)
  if (!el) return
  hop(el)
  sfx.cheer()
  for (let i = 0; i < 5; i++) {
    const f = document.createElement('span')
    f.className = 'float'
    f.textContent = emoji
    f.style.setProperty('--dx', `${(i - 2) * 18 + rand(10)}px`)
    f.style.animationDelay = `${i * 0.08}s`
    el.append(f)
    setTimeout(() => f.remove(), 1600)
  }
  if (to === room?.id) toast(`${from} sent you ${emoji}`)
}

// ——— Top bar and controls ———

function renderTop() {
  const top = $('#top')
  top.hidden = mode === 'home'
  if (mode === 'home') return
  const s = room?.state
  top.innerHTML = `
    <div class="brand">Study Room</div>
    ${mode === 'room' && room ? `<button type="button" class="code" id="copy" title="Copy invite link">📍 ${esc(room.code)} <small>copy invite</small></button>` : `<button type="button" class="code" id="invite">👋 Invite friends</button>`}
    ${s ? `<div class="goal"><b>🏆 Room goal</b><span>${formatDuration(s.studied)} / ${formatDuration(s.goal)}</span><i><em id="goal-fill" style="width:${Math.min(100, (s.studied / s.goal) * 100)}%"></em></i></div>` : ''}
    <div class="spacer"></div>
    <button type="button" class="icon" id="sound" aria-label="${soundOn ? 'Mute sounds' : 'Turn sounds on'}">${soundOn ? '🔊' : '🔈'}</button>
    <button type="button" class="ghost small" id="leave">${mode === 'room' ? 'Leave' : 'Back'}</button>`
}

$('#top').addEventListener('click', async (e) => {
  const b = (e.target as HTMLElement).closest('button')
  if (!b) return
  sfx.click()
  if (b.id === 'leave') return void leaveRoom()
  if (b.id === 'invite') return void makeRoom()
  if (b.id === 'sound') {
    soundOn = !soundOn
    store.set('sound', soundOn)
    setSound(soundOn)
    return renderTop()
  }
  if (b.id === 'copy' && room) {
    const link = `${location.origin}/?room=${room.code}`
    try {
      await navigator.clipboard.writeText(link)
      toast('Invite link copied! Send it to a friend.')
    } catch {
      toast(`Share this code: ${room.code}`)
    }
  }
})

function renderHud() {
  const hud = $('#hud')
  hud.hidden = mode === 'home'
  if (mode === 'home') return
  const running = timer.status !== 'idle'
  const paused = timer.pausedLeft != null
  const p = preset()
  hud.innerHTML = `
    <div class="modes">
      <button type="button" class="btn purple ${timer.status === 'study' ? 'on' : ''}" data-act="study">📚 Study</button>
      <button type="button" class="btn green ${timer.status === 'rest' ? 'on' : ''}" data-act="rest">😌 Rest</button>
      <button type="button" class="btn yellow ${timer.status === 'break' ? 'on' : ''}" data-act="break">🥤 Break</button>
    </div>
    <div class="presets">
      ${PRESETS.map((x) => `<button type="button" class="chip ${presetId === x.id ? 'on' : ''}" data-preset="${x.id}">${x.label}</button>`).join('')}
      <button type="button" class="chip ${presetId === 'custom' ? 'on' : ''}" data-preset="custom">✏️ ${presetId === 'custom' ? `${custom.study} / ${custom.rest}` : 'Custom'}</button>
    </div>
    <div class="clock">
      <span id="big-clock" class="${paused ? 'paused' : ''}">${formatClock(running ? secondsLeft(timer, Date.now()) : p.study * 60)}</span>
      ${running ? `<button type="button" class="ghost small" data-act="${paused ? 'resume' : 'pause'}">${paused ? '▶ Resume' : '⏸ Pause'}</button><button type="button" class="ghost small" data-act="stop">■ Stop</button>` : ''}
    </div>`
}

$('#hud').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button')
  if (!b) return
  const now = Date.now()
  const p = preset()
  if (b.dataset.preset) {
    if (b.dataset.preset === 'custom') {
      const s = prompt('Study minutes?', String(custom.study))
      if (s == null) return
      const r = prompt('Rest minutes?', String(custom.rest))
      if (r == null) return
      custom = { study: clampMinutes(Number(s)), rest: clampMinutes(Number(r)) }
      store.set('custom', custom)
    }
    presetId = b.dataset.preset
    store.set('preset', presetId)
    sfx.pick()
    return render()
  }
  switch (b.dataset.act) {
    case 'study':
      return setTimer(start('study', p.study, now))
    case 'rest':
      return setTimer(start('rest', p.rest, now))
    case 'break':
      return setTimer(start('break', BREAK_MINUTES, now))
    case 'pause':
      return setTimer(pause(timer, now), sfx.pause)
    case 'resume':
      return setTimer(resume(timer, now))
    case 'stop':
      return setTimer(IDLE, sfx.pause)
  }
})

function render() {
  document.body.dataset.mode = mode
  renderHome()
  renderTop()
  renderHud()
  renderPeople()
  updateClocks(Date.now())
}

render()
