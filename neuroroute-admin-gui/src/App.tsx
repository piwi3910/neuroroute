import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';

function App() {
  return (
    <Routes>
      {/* Routes requiring authentication and layout */}
      <Route path="/" element={<Layout />}>
        {/* Default route within the layout */}
        <Route index element={<HomePage />} />
        {/* Add other authenticated routes here later, e.g.: */}
        {/* <Route path="users" element={<UserManagementPage />} /> */}
        {/* <Route path="settings" element={<SettingsPage />} /> */}
      </Route>

      {/* Public routes (e.g., Login) */}
      <Route path="/login" element={<LoginPage />} />

      {/* Optional: Add a 404 Not Found route */}
      {/* <Route path="*" element={<NotFoundPage />} /> */}
    </Routes>
  );
}

export default App;
