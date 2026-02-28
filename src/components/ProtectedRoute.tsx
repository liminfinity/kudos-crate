import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import type { AppRole } from '@/lib/supabase-types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: AppRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  
  if (allowedRoles && role && !allowedRoles.includes(role)) {
    // Redirect employees to feedback form, others to dashboard
    const fallback = role === 'employee' ? '/feedback/new' : '/dashboard';
    return <Navigate to={fallback} replace />;
  }

  return <>{children}</>;
}
