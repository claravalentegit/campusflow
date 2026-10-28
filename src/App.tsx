import { createBrowserRouter, createMemoryRouter, RouterProvider } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { Today } from '@/pages/Today'

// Today ships in the main bundle; other pages load on first visit.
const page = <K extends string>(load: () => Promise<Record<K, React.ComponentType>>, name: K) => async () => ({ Component: (await load())[name] })

// The single-file build (npm run build:single) runs inside frames that don't allow path URLs,
// so it keeps navigation in memory instead of the address bar.
const createRouter = import.meta.env.VITE_MEMORY_ROUTER === '1' ? createMemoryRouter : createBrowserRouter

const router = createRouter([
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <Today /> },
      { path: '/courses', lazy: page(() => import('@/pages/Courses'), 'Courses') },
      { path: '/courses/:courseId', lazy: page(() => import('@/pages/CourseDetail'), 'CourseDetail') },
      { path: '/assignments/:assignmentId', lazy: page(() => import('@/pages/AssignmentDetail'), 'AssignmentDetail') },
      { path: '/calendar', lazy: page(() => import('@/pages/Calendar'), 'Calendar') },
      { path: '/connect', lazy: page(() => import('@/pages/Connect'), 'Connect') },
      { path: '/me', lazy: page(() => import('@/pages/Me'), 'Me') },
      { path: '/grades', lazy: page(() => import('@/pages/Grades'), 'Grades') },
      { path: '/settings', lazy: page(() => import('@/pages/Settings'), 'Settings') },
      { path: '*', lazy: page(() => import('@/pages/NotFound'), 'NotFound') },
    ],
  },
])

export function App() {
  return <RouterProvider router={router} />
}
