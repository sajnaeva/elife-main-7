import { Layout } from "@/components/layout/Layout";
import { useAuth } from "@/hooks/useAuth";
import { useDivisionAdminStats } from "@/hooks/useDivisionAdminStats";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link, Navigate, useParams } from "react-router-dom";
import {
  Calendar,
  Users,
  ClipboardList,
  TrendingUp,
  ArrowLeft,
  Loader2,
  Building2,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ShieldAlert,
  IndianRupee,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function DivisionAdminDashboard() {
  const { divisionId } = useParams<{ divisionId: string }>();
  const { isAdmin, isSuperAdmin, adminData } = useAuth();
  const stats = useDivisionAdminStats(divisionId);

  // Check authorization
  if (!isAdmin && !isSuperAdmin) {
    return <Navigate to="/unauthorized" replace />;
  }

  // Check if admin has access to this division
  const hasAccess =
    isSuperAdmin ||
    adminData?.access_all_divisions ||
    adminData?.division_id === divisionId ||
    (adminData?.additional_division_ids || []).includes(divisionId || "");

  if (!hasAccess) {
    return (
      <Layout>
        <div className="container py-8">
          <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
            <ShieldAlert className="h-16 w-16 text-destructive" />
            <h1 className="text-2xl font-bold text-foreground">Access Denied</h1>
            <p className="text-muted-foreground text-center max-w-md">
              You don't have permission to access this division. Contact the Super Admin to request access.
            </p>
            <Button asChild variant="outline">
              <Link to="/admin-dashboard">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Link>
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  if (stats.isLoading) {
    return (
      <Layout>
        <div className="container py-8 flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  const isPrimaryDivision = adminData?.division_id === divisionId;

  return (
    <Layout>
      <div className="container py-8">
        {/* Header */}
        <div className="flex flex-col gap-4 mb-8">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="icon" className="flex-shrink-0">
              <Link to={isSuperAdmin ? "/super-admin" : "/admin-dashboard"}>
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Building2 className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                  {stats.divisionName}
                </h1>
                {isPrimaryDivision && (
                  <Badge variant="default" className="text-xs">Primary</Badge>
                )}
                {!isPrimaryDivision && (
                  <Badge variant="secondary" className="text-xs">Permitted Access</Badge>
                )}
              </div>
              {stats.divisionDescription && (
                <p className="text-sm text-muted-foreground mt-1">
                  {stats.divisionDescription}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4 mb-6 sm:mb-8">
          <StatsCard
            title="Total Programs"
            value={stats.totalPrograms}
            description={`${stats.activePrograms} active`}
            icon={Calendar}
          />
          <StatsCard
            title="Registrations"
            value={stats.totalRegistrations}
            icon={ClipboardList}
          />
          <StatsCard
            title="Active Programs"
            value={stats.activePrograms}
            icon={TrendingUp}
          />
          <StatsCard
            title="Total Members"
            value={stats.totalMembers}
            icon={Users}
          />
        </div>

        {/* Quick Actions */}
        <div className="grid gap-2 sm:gap-4 grid-cols-2 sm:grid-cols-3 mb-6 sm:mb-8">
          <Button asChild variant="outline" className="h-auto py-3 sm:py-4">
            <Link to="/admin/programs" className="flex flex-col items-center gap-1.5 sm:gap-2">
              <Calendar className="h-5 w-5 sm:h-6 sm:w-6" />
              <span className="text-xs sm:text-sm">Manage Programs</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-auto py-3 sm:py-4">
            <Link to="/admin/members" className="flex flex-col items-center gap-1.5 sm:gap-2">
              <Users className="h-5 w-5 sm:h-6 sm:w-6" />
              <span className="text-xs sm:text-sm">Manage Members</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-auto py-3 sm:py-4">
            <Link to="/admin/clusters" className="flex flex-col items-center gap-1.5 sm:gap-2">
              <ClipboardList className="h-5 w-5 sm:h-6 sm:w-6" />
              <span className="text-xs sm:text-sm">Manage Clusters</span>
            </Link>
          </Button>
           {divisionId === "e108eb84-b8a2-452d-b0d4-350d0c90303b" && (
            <Button asChild variant="outline" className="h-auto py-3 sm:py-4">
              <Link to="/admin/pennyekart-agents" className="flex flex-col items-center gap-1.5 sm:gap-2">
                <Users className="h-5 w-5 sm:h-6 sm:w-6" />
                <span className="text-xs sm:text-sm">Pennyekart Agents</span>
              </Link>
            </Button>
          )}
          {adminData?.cash_collection_enabled && (
            <Button asChild variant="outline" className="h-auto py-3 sm:py-4">
              <Link to={`/admin/division/${divisionId}/cash-collections`} className="flex flex-col items-center gap-1.5 sm:gap-2">
                <IndianRupee className="h-5 w-5 sm:h-6 sm:w-6" />
                <span className="text-xs sm:text-sm">Cash Collection</span>
              </Link>
            </Button>
          )}
        </div>

        <div className="grid gap-4 sm:gap-6 lg:grid-cols-2 mb-6 sm:mb-8">
          {/* Programs List */}
          <Card>
            <CardHeader className="pb-3 sm:pb-6">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                Programs
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                All programs in this division
              </CardDescription>
            </CardHeader>
            <CardContent className="px-3 sm:px-6">
              {stats.programs.length === 0 ? (
                <p className="text-muted-foreground text-sm py-4 text-center">
                  No programs yet
                </p>
              ) : (
                <div className="space-y-2 max-h-[350px] overflow-y-auto">
                  {stats.programs.map((program) => (
                    <Link
                      key={program.id}
                      to={`/admin/programs/${program.id}`}
                      className="flex items-center justify-between p-2.5 sm:p-3 rounded-lg border hover:bg-accent/50 transition-colors group"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-xs sm:text-sm truncate">
                          {program.name}
                        </p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">
                          {program.registrationCount} registration{program.registrationCount !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <Badge
                        variant={program.is_active ? "default" : "secondary"}
                        className="text-[10px] sm:text-xs ml-2 flex-shrink-0"
                      >
                        {program.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Registrations */}
          <Card>
            <CardHeader className="pb-3 sm:pb-6">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <ClipboardList className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                Recent Registrations
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Latest registrations in this division
              </CardDescription>
            </CardHeader>
            <CardContent className="px-3 sm:px-6">
              {stats.recentRegistrations.length === 0 ? (
                <p className="text-muted-foreground text-sm py-4 text-center">
                  No registrations yet
                </p>
              ) : (
                <div className="space-y-2 max-h-[350px] overflow-y-auto">
                  {stats.recentRegistrations.map((reg) => (
                    <div key={reg.id} className="flex items-start gap-3 p-2.5 sm:p-3 rounded-lg border">
                      <div className="p-1.5 rounded-full flex-shrink-0 bg-primary/10">
                        {reg.verification_status === "verified" ? (
                          <CheckCircle className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                        ) : reg.verification_status === "rejected" ? (
                          <XCircle className="h-3.5 w-3.5 text-destructive" />
                        ) : (
                          <AlertCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-xs sm:text-sm truncate">
                          {reg.registrant_name}
                        </p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                          {reg.program_name}
                        </p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <Clock className="h-2.5 w-2.5" />
                          {formatDistanceToNow(new Date(reg.created_at), { addSuffix: true })}
                        </p>
                      </div>
                      <Badge
                        variant={
                          reg.verification_status === "verified"
                            ? "default"
                            : reg.verification_status === "rejected"
                            ? "destructive"
                            : "secondary"
                        }
                        className="text-[10px] flex-shrink-0"
                      >
                        {reg.verification_status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {stats.error && (
          <div className="mt-4 p-4 bg-destructive/10 text-destructive rounded-lg">
            Error loading stats: {stats.error}
          </div>
        )}
      </div>
    </Layout>
  );
}
