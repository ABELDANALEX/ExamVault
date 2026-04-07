import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import AppShell from './components/AppShell';
import LoadingScreen from './components/LoadingScreen';
import NoticeStack from './components/NoticeStack';
import { AppProvider, useApp } from './context/AppContext';
import AdminDashboardPage from './pages/AdminDashboardPage';
import BlueprintsPage from './pages/BlueprintsPage';
import FacultyDashboardPage from './pages/FacultyDashboardPage';
import GeneratePage from './pages/GeneratePage';
import LoginPage from './pages/LoginPage';
import QuestionsPage from './pages/QuestionsPage';
import RegisterPage from './pages/RegisterPage';

function ProtectedRoute({ roles, children }) {
  const { currentUser, sessionLoading } = useApp();
  const location = useLocation();

  if (sessionLoading) {
    return <LoadingScreen />;
  }

  if (!currentUser) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (roles && !roles.includes(currentUser.role)) {
    return <Navigate to={currentUser.role === 'admin' ? '/admin' : '/faculty'} replace />;
  }

  return children;
}

function ShellWithLogout() {
  const { currentUser, logout } = useApp();
  const navigate = useNavigate();

  return (
    <AppShell
      user={currentUser}
      onLogout={async () => {
        await logout();
        navigate('/login', { replace: true });
      }}
    />
  );
}

function AppRoutes() {
  const { currentUser, sessionLoading, notices, dismissNotice } = useApp();

  if (sessionLoading) {
    return <LoadingScreen />;
  }

  return (
    <>
      <NoticeStack notices={notices} onDismiss={dismissNotice} />

      <Routes>
        <Route
          path="/login"
          element={currentUser ? <Navigate to={currentUser.role === 'admin' ? '/admin' : '/faculty'} replace /> : <LoginPage />}
        />
        <Route
          path="/register"
          element={currentUser ? <Navigate to={currentUser.role === 'admin' ? '/admin' : '/faculty'} replace /> : <RegisterPage />}
        />

        <Route
          element={
            <ProtectedRoute roles={['admin', 'faculty']}>
              <ShellWithLogout />
            </ProtectedRoute>
          }
        >
          <Route
            path="/admin"
            element={
              <ProtectedRoute roles={['admin']}>
                <AdminDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/faculty"
            element={
              <ProtectedRoute roles={['faculty']}>
                <FacultyDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/faculty/questions"
            element={
              <ProtectedRoute roles={['faculty']}>
                <QuestionsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/faculty/blueprints"
            element={
              <ProtectedRoute roles={['faculty']}>
                <BlueprintsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/faculty/generate"
            element={
              <ProtectedRoute roles={['faculty']}>
                <GeneratePage />
              </ProtectedRoute>
            }
          />
        </Route>

        <Route
          path="*"
          element={<Navigate to={currentUser ? (currentUser.role === 'admin' ? '/admin' : '/faculty') : '/login'} replace />}
        />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppRoutes />
    </AppProvider>
  );
}
