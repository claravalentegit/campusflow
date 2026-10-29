import { createBrowserRouter, createMemoryRouter, Navigate, RouterProvider, useLocation, useParams } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { Today } from '@/pages/Today'

// Today ships in the main bundle; other pages load on first visit.
const page = <K extends string>(load: () => Promise<Record<K, React.ComponentType>>, name: K) => async () => ({ Component: (await load())[name] })

// The single-file build (npm run build:single) runs inside frames that don't allow path URLs,
// so it keeps navigation in memory instead of the address bar.
const createRouter = import.meta.env.VITE_MEMORY_ROUTER === '1' ? createMemoryRouter : createBrowserRouter

// Older links (bookmarks, notifications) land on the tab that now holds that content.
function OpenAssignment() {
  const { assignmentId } = useParams()
  return <Navigate to={`/?open=${assignmentId}`} replace />
}
function ToSettings() {
  const { hash } = useLocation()
  return <Navigate to={`/me${hash || '#settings'}`} replace />
}

const router = createRouter([
  // Parents: their own screens, outside the student app.
  { path: '/parent', lazy: page(() => import('@/parent/ParentApp'), 'ParentApp') },
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <Today /> },
      { path: '/courses', lazy: page(() => import('@/pages/Courses'), 'Courses') },
      { path: '/me', lazy: page(() => import('@/pages/Me'), 'Me') },
      { path: '/connect', lazy: page(() => import('@/pages/Connect'), 'Connect') },
      { path: '/assignments/:assignmentId', element: <OpenAssignment /> },
      { path: '/courses/:courseId', element: <Navigate to="/courses" replace /> },
      { path: '/grades', element: <Navigate to="/courses" replace /> },
      { path: '/calendar', element: <Navigate to="/" replace /> },
      { path: '/settings', element: <ToSettings /> },
      { path: '*', lazy: page(() => import('@/pages/NotFound'), 'NotFound') },
    ],
  },
])

export function App() {
  return <RouterProvider router={router} />
}
