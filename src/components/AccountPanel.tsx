import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { formatDistanceToNowStrict } from 'date-fns'
import QRCode from 'qrcode'
import { CloudCheck, CloudOff, LogOut, Plug, Smartphone, TriangleAlert, UserRound } from 'lucide-react'
import { dateLocale, useT } from '@/i18n'
import { accountApi, pullAccount, useAccountSync, type AccountInfo } from '@/integrations/account'
import { canvasApi } from '@/integrations/canvas/adapter'
import { DEFAULT_PREFS, useStore } from '@/store/appStore'
import { toast } from '@/store/ui'
import { sfx } from '@/game/fx'
import { Button } from '@/components/ui/Button'
import { confirm } from '@/components/ui/Dialog'
import { Panel } from '@/components/ui/Panel'

/** Me → Your account: who you're signed in as, that progress is saved, and moving to another device. */
export function AccountPanel() {
  const t = useT()
  const navigate = useNavigate()
  const prefs = useStore((s) => s.prefs)
  const sync = useAccountSync()
  const [info, setInfo] = useState<AccountInfo | null>(null)
  const [code, setCode] = useState<{ code: string; expiresAt: number; qr: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const connected = prefs.dataMode === 'canvas'

  useEffect(() => {
    if (connected) void accountApi.info().then(setInfo, () => setInfo(null))
  }, [connected])

  useEffect(() => {
    if (!code) return
    const id = setTimeout(() => setCode(null), Math.max(0, code.expiresAt - Date.now()))
    return () => clearTimeout(id)
  }, [code])

  const makeCode = async () => {
    setBusy(true)
    try {
      const c = await accountApi.deviceCode()
      const qr = await QRCode.toDataURL(`${location.origin}/link?code=${c.code}`, { margin: 1, width: 220, color: { dark: '#2a1d33', light: '#ffffff' } })
      setCode({ ...c, qr })
      sfx.pop()
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const signOut = async () => {
    if (!(await confirm({ title: t('Sign out of this device?'), message: t('Your progress is saved to your account. This device forgets it until you sign in again.'), confirmLabel: t('Sign out'), tone: 'primary' }))) return
    // Save anything not saved yet, then forget everything on this device.
    if (useStore.getState().prefs.account.dirty) await pullAccount()
    await canvasApi.logout().catch(() => {})
    const { language, theme } = useStore.getState().prefs
    useStore.getState().startEmpty()
    useStore.setState({ prefs: { ...DEFAULT_PREFS, language, theme, displayName: '', dataMode: 'manual', onboarded: false } })
    navigate('/connect')
  }

  const savedAt = sync.savedAt ?? prefs.account.savedAt
  return (
    <Panel id="account" title={t('Your account')} description={t('Your Canvas account is your CampusFlow account: no new password.')} icon={UserRound} tone="accent" bodyClassName="flex flex-col gap-4 px-5 pt-2 pb-5">
      {!connected ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm font-semibold text-fg-2">{t('Connect Canvas to save your XP, pet and progress to your account, and use them on any device.')}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" icon={Plug} onClick={() => navigate('/connect')}>
              {t('Connect Canvas')}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 rounded-2xl bg-surface-2 px-4 py-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-accent text-lg font-black text-white">{(prefs.canvasUser ?? '?').slice(0, 1).toUpperCase()}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-black">{prefs.canvasUser}</span>
              <span className="block truncate text-xs font-bold text-fg-3">{prefs.canvasHost}</span>
            </span>
          </div>
          <p className="flex items-center gap-2 text-sm font-bold" data-testid="account-status">
            {sync.state === 'error' ? (
              <>
                <CloudOff className="size-4 text-danger" aria-hidden />
                <span className="text-danger">{t('Couldn’t save to your account. It will try again.')}</span>
              </>
            ) : sync.state === 'saving' ? (
              <span className="text-fg-3">{t('Saving…')}</span>
            ) : (
              <>
                <CloudCheck className="size-4 text-success" aria-hidden />
                <span className="text-success">{savedAt ? t('Saved to your account {ago}', { ago: formatDistanceToNowStrict(new Date(savedAt), { addSuffix: true, locale: dateLocale() }) }) : t('Saved to your account')}</span>
              </>
            )}
          </p>
          {info?.storage === 'memory' && (
            <p className="flex items-start gap-2 rounded-xl bg-warn-soft px-3 py-2 text-xs font-bold text-warn">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              {t('The CampusFlow server has no database yet, so your account copy resets when the server restarts. Your progress on this device is safe.')}
            </p>
          )}
          <AnimatePresence initial={false}>
            {code && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="card-3d flex flex-col items-center gap-2 p-5 text-center" data-testid="device-code">
                <p className="text-sm font-extrabold text-fg-2">{t('On the other device, open CampusFlow → “Signed in on another device? Use a code”, then type:')}</p>
                <p className="tabular text-4xl font-black tracking-[0.2em] text-accent-text">
                  {code.code.slice(0, 3)}-{code.code.slice(3)}
                </p>
                <img src={code.qr} width={180} height={180} alt={t('QR code that signs another device in')} className="rounded-xl border-2 border-line" />
                <p className="text-xs font-bold text-fg-3">{t('Or scan this with its camera. The code works once, for 10 minutes. Only share it with your own devices.')}</p>
                <Button size="sm" variant="ghost" onClick={() => setCode(null)}>
                  {t('Cancel')}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="flex flex-wrap gap-2">
            {!code && (
              <Button variant="primary" icon={Smartphone} disabled={busy} onClick={() => void makeCode()}>
                {t('Use on another device')}
              </Button>
            )}
            <Button variant="ghost" icon={LogOut} onClick={() => void signOut()}>
              {t('Sign out of this device')}
            </Button>
          </div>
        </>
      )}
    </Panel>
  )
}
