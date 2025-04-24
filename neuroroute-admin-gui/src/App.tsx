import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { UserManagementPage } from './pages/UserManagementPage';
import { SettingsPage } from './pages/SettingsPage';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthProvider } from './contexts/AuthContext';

function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public routes (e.g., Login) */}
        <Route path="/login" element={<LoginPage />} />

        {/* Protected routes requiring authentication */}
        <Route element={<ProtectedRoute />}>
          {/* Layout wrapper for authenticated routes */}
          <Route element={<Layout />}>
            {/* Default route within the layout */}
            <Route index element={<HomePage />} />
            
            {/* Admin feature routes */}
            <Route path="users" element={<UserManagementPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="audit-logs" element={<AuditLogsPage />} />
          </Route>
        </Route>

        {/* Optional: Add a 404 Not Found route */}
        {/* <Route path="*" element={<NotFoundPage />} /> */}
      </Routes>
    </AuthProvider>
  );
}

export default App;
