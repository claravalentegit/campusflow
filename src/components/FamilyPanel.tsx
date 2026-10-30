import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { formatDistanceToNowStrict } from 'date-fns'
import QRCode from 'qrcode'
import { Eye, Heart, Plug, UserPlus, Users } from 'lucide-react'
import { buildSnapshot, familyApi, type ParentLink } from '@/integrations/family'
import { useStore } from '@/store/appStore'
import { toast } from '@/store/ui'
import { sfx } from '@/game/fx'
import { Button } from '@/components/ui/Button'
import { confirm } from '@/components/ui/Dialog'
import { Panel } from '@/components/ui/Panel'
import { dateLocale, useT } from '@/i18n'

/** Me → Family: link parent devices with a code, see who's linked, remove anyone. */
export function FamilyPanel() {
  const mode = useStore((s) => s.prefs.dataMode)
  const update = useStore((s) => s.updatePrefs)
  const navigate = useNavigate()
  const [parents, setParents] = useState<ParentLink[] | null>(null)
  const [code, setCode] = useState<{ code: string; expiresAt: number; qr: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const t = useT()

  const refresh = useCallback(async () => {
    try {
      const o = await familyApi.overview()
      setParents(o.parents)
      setError(null)
      update({ familySharing: o.parents.length > 0 })
      return o.parents
    } catch (e) {
      setError((e as Error).message)
      return null
    }
  }, [update])

  useEffect(() => {
    if (mode === 'canvas') void refresh()
  }, [mode, refresh])

  // While a code is showing, watch for the parent to finish linking.
  useEffect(() => {
    if (!code) return
    const id = setInterval(async () => {
      const before = parents?.length ?? 0
      const list = await refresh()
      if (list && list.length > before) {
        setCode(null)
        sfx.quest()
        toast(t('{name} is linked', { name: list[list.length - 1].name }))
        void familyApi.upload(buildSnapshot(useStore.getState())).catch(() => {})
      }
      if (Date.now() > code.expiresAt) setCode(null)
    }, 3000)
    return () => clearInterval(id)
  }, [code, parents, refresh, t])

  const addParent = async () => {
    setBusy(true)
    try {
      const c = await familyApi.createCode()
      const link = `${location.origin}/parent?code=${c.code}`
      const qr = await QRCode.toDataURL(link, { margin: 1, width: 220, color: { dark: '#2a1d33', light: '#ffffff' } })
      setCode({ ...c, qr })
      update({ familySharing: true })
      sfx.pop()
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (p: ParentLink) => {
    if (!(await confirm({ title: t('Stop sharing with {name}?', { name: p.name }), message: t('{name} won’t see your CampusFlow anymore, and they’ll be told you stopped sharing.', { name: p.name }), confirmLabel: t('Stop sharing') }))) return
    try {
      const o = await familyApi.remove(p.id)
      setParents(o.parents)
      update({ familySharing: o.parents.length > 0 })
      toast(t('Stopped sharing with {name}', { name: p.name }))
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  return (
    <Panel id="family" title={t('Family')} description={t('Let a parent follow your school year, with no Canvas account needed.')} icon={Users} tone="green" bodyClassName="flex flex-col gap-4 px-5 pt-2 pb-5">
      {mode !== 'canvas' ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm font-semibold text-fg-2">{t('Connect Canvas first. Parents see your real classes, not the demo.')}</p>
          <Button variant="primary" icon={Plug} onClick={() => navigate('/connect')}>
            {t('Connect Canvas')}
          </Button>
        </div>
      ) : (
        <>
          <p className="text-sm font-semibold text-fg-2">{t('Linked parents see everything in CampusFlow: every assignment (including skipped ones), grades, teacher messages and your progress. Your private notes stay private.')}</p>
          {error && <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm font-bold text-danger">{error}</p>}
          <AnimatePresence initial={false}>
            {code && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="card-3d flex flex-col items-center gap-2 p-5 text-center" data-testid="family-code">
                <p className="text-sm font-extrabold text-fg-2">{t('On their phone, open CampusFlow → “I’m a parent”, then type:')}</p>
                <p className="tabular text-4xl font-black tracking-[0.2em] text-accent-text">
                  {code.code.slice(0, 3)}-{code.code.slice(3)}
                </p>
                <img src={code.qr} width={180} height={180} alt={t('QR code that opens CampusFlow with this code')} className="rounded-xl border-2 border-line" />
                <p className="text-xs font-bold text-fg-3">{t('Or scan this with their camera. The code works once, for 15 minutes.')}</p>
                <Button size="sm" variant="ghost" onClick={() => setCode(null)}>
                  {t('Cancel')}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
          {parents && parents.length > 0 && (
            <section aria-label={t('Shared with')}>
              <h3 className="mb-2 text-xs font-black tracking-[0.12em] text-fg-3 uppercase">{t('Shared with')}</h3>
              <ul className="flex flex-col gap-2">
                {parents.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 rounded-2xl bg-surface-2 px-3 py-2.5">
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#0ea5a4] text-base font-black text-white">{p.name.slice(0, 1).toUpperCase()}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-black">{p.name}</span>
                      <span className="flex items-center gap-1 text-xs font-bold text-fg-3">
                        <Eye className="size-3.5" aria-hidden />
                        {p.lastSeenAt ? t('looked {ago}', { ago: formatDistanceToNowStrict(new Date(p.lastSeenAt), { addSuffix: true, locale: dateLocale() }) }) : t('hasn’t looked yet')}
                      </span>
                      {p.guideDoneAt && Date.now() - new Date(p.guideDoneAt).getTime() < 7 * 86_400_000 && (
                        <span className="flex items-center gap-1 text-xs font-black text-success" data-testid="guide-done-note">
                          <Heart className="size-3.5 fill-current" aria-hidden />
                          {t('Finished their weekly guide to support you')}
                        </span>
                      )}
                    </span>
                    <Button size="sm" variant="ghost" className="text-danger hover:text-danger" onClick={() => void remove(p)}>
                      {t('Remove')}
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {!code && (
            <Button variant="primary" icon={UserPlus} className="self-start" disabled={busy} onClick={() => void addParent()}>
              {t('Add a parent')}
            </Button>
          )}
        </>
      )}
    </Panel>
  )
}
