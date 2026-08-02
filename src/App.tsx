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
import { RepairsView } from './views/repairs/RepairsView';

// ==========================================
// QUERY CLIENT — tuned to feel like a native mobile app
// Realtime handles live updates while the app is open; these defaults
// cover the gaps: returning to a backgrounded tab, regaining network,
// and transient failures.
// ==========================================
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Refetch when the user comes back to the tab/app
      refetchOnWindowFocus: true,
      // Refetch as soon as the network returns
      refetchOnReconnect: true,
      // Data older than 30s is refetched on mount/focus; realtime
      // invalidation still updates things instantly while open
      staleTime: 30_000,
      // Keep unused data around briefly so navigating back is instant
      gcTime: 5 * 60_000,
      // Retry transient network failures with backoff, but never retry
      // permission/validation errors forever
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    },
    mutations: {
      // Money and stock actions must never be silently retried —
      // idempotency lives in the database, not in guesswork here
      retry: 0,
    },
  },
});

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
                    <Route path="/repairs" element={<RepairsView />} />
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