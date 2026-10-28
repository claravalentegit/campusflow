import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { Page, usePageTitle } from '@/components/Page'
import { EmptyState } from '@/components/ui/EmptyState'

export function NotFound({ what = 'page' }: { what?: string }) {
  usePageTitle('Not found')
  return (
    <Page>
      <EmptyState
        icon={Compass}
        title={`This ${what} doesn’t exist`}
        description={what === 'page' ? 'The link may be mistyped.' : `It may have been deleted, or the link is from another device. CampusFlow data is stored in this browser only.`}
        actions={
          <Link to="/" className="inline-flex h-8.5 items-center rounded-md border border-line bg-surface px-3 text-sm font-medium shadow-sm hover:bg-surface-2">
            Back to Today
          </Link>
        }
      />
    </Page>
  )
}
