import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './components/ui/Toast';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute, GuestRoute, ManagerRoute, SalespersonRoute } from './components/routing/RouteGuards';
import { DashboardShell } from './components/layout/DashboardShell';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { PendingApprovalPage } from './pages/PendingApprovalPage';
import { SuspendedPage } from './pages/SuspendedPage';
import { DashboardView } from './views/dashboard/DashboardView';
import { InventoryView } from './views/inventory/InventoryView';
import { TeamApprovalsView } from './views/team/TeamApprovalsView';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WalletView } from './views/wallet/WalletView';
import { OrdersView } from './views/orders/OrdersView';
import { POSView } from './views/sales/POSView';
import { SalesHistoryView } from './views/sales/SalesHistoryView';
import { AuditLogsView } from './views/audit/AuditLogsView';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <Routes>
              {/* Guest-only routes */}
              <Route element={<GuestRoute />}>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              </Route>
              {/* Status gates (self-guarding pages) */}
              <Route path="/pending" element={<PendingApprovalPage />} />
              <Route path="/suspended" element={<SuspendedPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              {/* Active users only */}
              <Route element={<ProtectedRoute />}>
                <Route element={<DashboardShell />}>
                  <Route path="/dashboard" element={<DashboardView />} />
                  <Route path="/inventory" element={<InventoryView />} />
                  <Route path="/sales" element={<SalesHistoryView />} />
                  <Route element={<ManagerRoute />}>
                    <Route path="/team" element={<TeamApprovalsView />} />
                    <Route path="/wallet" element={<WalletView />} />
                    <Route path="/orders" element={<OrdersView />} />
                    <Route path="/audit" element={<AuditLogsView />} />
                  </Route>
                  <Route element={<SalespersonRoute />}>
                    <Route path="/pos" element={<POSView />} />
                  </Route>
                </Route>
              </Route>
              {/* Fallback — guards will re-route to /login if not authed */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}