import { createBrowserRouter } from 'react-router-dom'
import { HomePage } from '../features/games/HomePage'
import { LoginPage } from '../features/auth/LoginPage'
import { AdminLayout } from '../features/admin/AdminLayout'
import { AdminDashboard } from '../features/admin/AdminDashboard'
import { PlayersPage } from '../features/admin/PlayersPage'

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
      // More admin routes will be added later
    ],
  },
  // Play routes will be added later: /play/abqarino/:sessionId
])
