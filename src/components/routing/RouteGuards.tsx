import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { FullScreenLoader } from '../ui/BrandLogo';

/** Wraps routes that require an ACTIVE, logged-in user. */
export const ProtectedRoute = () => {
  const { user, isInitializing } = useAuth();

  if (isInitializing) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.status === 'pending') return <Navigate to="/pending" replace />;
  if (user.status === 'suspended') return <Navigate to="/suspended" replace />;

  return <Outlet />;
};

/** Wraps routes only guests should see (login/register). Logged-in users get bounced to the right place. */
export const GuestRoute = () => {
  const { user, isInitializing } = useAuth();

  if (isInitializing) return <FullScreenLoader />;
  if (user) {
    if (user.status === 'pending') return <Navigate to="/pending" replace />;
    if (user.status === 'suspended') return <Navigate to="/suspended" replace />;
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};

/** Nested inside ProtectedRoute — blocks non-managers from manager-only routes like /team. */
export const ManagerRoute = () => {
  const { user } = useAuth();
  if (user?.role !== 'manager') return <Navigate to="/dashboard" replace />;
  return <Outlet />;
};

/** Blocks non-salespersons from POS routes (PRD §12: only salespersons record sales). */
export const SalespersonRoute = () => {
  const { user } = useAuth();
  if (user?.role !== 'salesperson') return <Navigate to="/dashboard" replace />;
  return <Outlet />;
};