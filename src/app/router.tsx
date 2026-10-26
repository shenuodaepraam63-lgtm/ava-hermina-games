import { createBrowserRouter } from 'react-router-dom'
import { HomePage } from '../features/games/HomePage'
import { LoginPage } from '../features/auth/LoginPage'
import { AdminLayout } from '../features/admin/AdminLayout'
import { AdminDashboard } from '../features/admin/AdminDashboard'
import { PlayersPage } from '../features/admin/PlayersPage'
import { GroupsPage } from '../features/admin/GroupsPage'
import { QuestionsPage } from '../features/admin/QuestionsPage'
import { SettingsPage } from '../features/admin/SettingsPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <HomePage />,
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/admin',
    element: <AdminLayout />,
    children: [
      {
        index: true,
        element: <AdminDashboard />,
      },
      {
        path: 'players',
        element: <PlayersPage />,
      },
      {
        path: 'groups',
        element: <GroupsPage />,
      },
      {
        path: 'questions',
        element: <QuestionsPage />,
      },
      {
        path: 'settings',
        element: <SettingsPage />,
      },
      // Play / sessions routes will be added next
    ],
  },
  // Play routes: /play/abqarino/:sessionId
])
