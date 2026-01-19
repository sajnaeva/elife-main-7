import { Navigate } from 'react-router-dom';
import { useAdminAuthSupabase, AdminRole } from '@/hooks/useAdminAuthSupabase';
import { Loader2 } from 'lucide-react';

interface AdminRouteProps {
  children: React.ReactNode;
  requiredRole?: AdminRole;
}

export function AdminRoute({ children, requiredRole }: AdminRouteProps) {
  const { isAdmin, roles, loading, isSuperAdmin, user } = useAdminAuthSupabase();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Redirect to admin login if not authenticated
  if (!user) {
    return <Navigate to="/admin/login" replace />;
  }

  // Redirect to admin login if authenticated but not admin
  if (!isAdmin) {
    return <Navigate to="/admin/login" replace />;
  }

  // Redirect to admin dashboard if doesn't have required role
  if (requiredRole && !roles.includes(requiredRole) && !isSuperAdmin) {
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
}
