import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/Layout';
import { ProtectedRoute, AdminRoute } from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import AccountsPage from './pages/AccountsPage';
import AccountDetailPage from './pages/AccountDetailPage';
import TransferPage from './pages/TransferPage';
import BillPayPage from './pages/BillPayPage';
import ScheduledTransfersPage from './pages/ScheduledTransfersPage';
import CardsPage from './pages/CardsPage';
import LoansPage from './pages/LoansPage';
import DocumentsPage from './pages/DocumentsPage';
import ProfileSettingsPage from './pages/ProfileSettingsPage';
import SecuritySettingsPage from './pages/SecuritySettingsPage';
import NotificationsPage from './pages/NotificationsPage';
import AdminDashboardPage, {
  AdminCardApplicationsPage,
  AdminLoanApplicationsPage,
  AdminUsersPage,
  AdminFeatureFlagsPage,
} from './pages/AdminPages';

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/accounts" element={<AccountsPage />} />
              <Route path="/accounts/:id" element={<AccountDetailPage />} />
              <Route path="/transfer" element={<TransferPage />} />
              <Route path="/bill-pay" element={<BillPayPage />} />
              <Route path="/transfer/scheduled" element={<ScheduledTransfersPage />} />
              <Route path="/cards" element={<CardsPage />} />
              <Route path="/cards/apply" element={<CardsPage />} />
              <Route path="/loans" element={<LoansPage />} />
              <Route path="/loans/apply" element={<LoansPage />} />
              <Route path="/documents" element={<DocumentsPage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/settings/profile" element={<ProfileSettingsPage />} />
              <Route path="/settings/security" element={<SecuritySettingsPage />} />
              <Route path="/admin" element={<AdminRoute><AdminDashboardPage /></AdminRoute>} />
              <Route path="/admin/applications/cards" element={<AdminRoute><AdminCardApplicationsPage /></AdminRoute>} />
              <Route path="/admin/applications/loans" element={<AdminRoute><AdminLoanApplicationsPage /></AdminRoute>} />
              <Route path="/admin/users" element={<AdminRoute><AdminUsersPage /></AdminRoute>} />
              <Route path="/admin/feature-flags" element={<AdminRoute><AdminFeatureFlagsPage /></AdminRoute>} />
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
