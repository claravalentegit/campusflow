import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { Page, usePageTitle } from '@/components/Page'
import { EmptyState } from '@/components/ui/EmptyState'
import { useT } from '@/i18n'

export function NotFound({ what = 'page' }: { what?: string }) {
  const t = useT()
  usePageTitle(t('Not found'))
  return (
    <Page>
      <EmptyState
        icon={Compass}
        title={what === 'page' ? t('This page doesn’t exist') : t('This item doesn’t exist')}
        description={what === 'page' ? t('The link may be mistyped.') : t('It may have been deleted, or the link is from another device. CampusFlow data is stored in this browser only.')}
        actions={
          <Link to="/" className="btn-3d inline-flex h-11 items-center rounded-xl bg-accent px-5 text-sm font-black text-white [--press:var(--accent-press)]">
            {t('Back to Today')}
          </Link>
        }
      />
    </Page>
  )
}
