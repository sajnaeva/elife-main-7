import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { useAuth } from "@/hooks/useAuth";
import { useSuperAdminStats } from "@/hooks/useSuperAdminStats";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link, Navigate } from "react-router-dom";
import { 
  Shield, 
  Users, 
  Building2, 
  Calendar,
  ClipboardList,
  Activity,
  LogOut,
  Loader2,
  UserCheck,
  UserX,
  TrendingUp,
  Clock,
  Plus,
  IndianRupee,
  FileSpreadsheet,
  BarChart3
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { DivisionFormDialog } from "@/components/admin/DivisionFormDialog";

export default function SuperAdminDashboard() {
  const { isSuperAdmin, signOut, user } = useAuth();
  const stats = useSuperAdminStats();
  const { toast } = useToast();

  const [divisionDialogOpen, setDivisionDialogOpen] = useState(false);

  // Redirect non-super-admins
  if (!isSuperAdmin) {
    return <Navigate to="/unauthorized" replace />;
  }

  const handleCreateDivision = async (data: { name: string; name_ml: string; description: string; color: string; icon: string; is_active: boolean }) => {
    const { error } = await supabase.from("divisions").insert({
      name: data.name,
      name_ml: data.name_ml || null,
      description: data.description || null,
      color: data.color || null,
      icon: data.icon || null,
      is_active: data.is_active,
    });
    if (error) throw error;
    toast({ title: "Division Created", description: `${data.name} has been added.` });
    stats.refetch();
  };

  const handleToggleAdmin = async (adminId: string, currentStatus: boolean, adminName: string) => {
    try {
      await stats.toggleAdminStatus(adminId, currentStatus);
      toast({
        title: "Status Updated",
        description: `${adminName} has been ${!currentStatus ? "activated" : "deactivated"}.`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update admin status",
        variant: "destructive",
      });
    }
  };

  if (stats.isLoading) {
    return (
      <Layout>
        <div className="container py-8 flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container py-8">
        {/* Header */}
        <div className="flex flex-col gap-4 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Super Admin</h1>
              <p className="text-sm sm:text-base text-muted-foreground">
                System-wide overview and management
              </p>
            </div>
            <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 text-xs sm:text-sm font-medium">
                <Shield className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                Super Admin
              </span>
              <Button variant="outline" size="sm" onClick={signOut} className="h-8 sm:h-9">
                <LogOut className="h-4 w-4 mr-1.5 sm:mr-2" />
                <span className="hidden xs:inline">Sign Out</span>
                <span className="xs:hidden">Exit</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Overview Stats */}
        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4 mb-6 sm:mb-8">
          <StatsCard
            title="Admins"
            value={stats.totalAdmins}
            description={`${stats.activeAdmins} active`}
            icon={Shield}
          />
          <StatsCard
            title="Divisions"
            value={stats.totalDivisions}
            description={`${stats.activeDivisions} active`}
            icon={Building2}
          />
          <StatsCard
            title="Programs"
            value={stats.totalPrograms}
            description={`${stats.activePrograms} active`}
            icon={Calendar}
          />
          <StatsCard
            title="Registrations"
            value={stats.totalRegistrations}
            icon={ClipboardList}
          />
        </div>

        {/* Quick Actions */}
        <div className="grid gap-2 sm:gap-4 grid-cols-3 sm:grid-cols-6 mb-6 sm:mb-8">
          <Button asChild variant="outline" className="h-auto py-3 sm:py-4">
            <Link to="/admin/admins" className="flex flex-col items-center gap-1.5 sm:gap-2">
              <Shield className="h-5 w-5 sm:h-6 sm:w-6" />
              <span className="text-[10px] sm:text-sm">Admins</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-auto py-3 sm:py-4">
            <a href="#divisions-overview" className="flex flex-col items-center gap-1.5 sm:gap-2">
              <Building2 className="h-5 w-5 sm:h-6 sm:w-6" />
              <span className="text-[10px] sm:text-sm">Divisions</span>
            </a>
          </Button>
          <Button asChild variant="outline" className="h-auto py-3 sm:py-4">
            <Link to="/admin/programs" className="flex flex-col items-center gap-1.5 sm:gap-2">
              <Calendar className="h-5 w-5 sm:h-6 sm:w-6" />
              <span className="text-[10px] sm:text-sm">Programs</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-auto py-3 sm:py-4">
            <Link to="/super-admin/cash-collections" className="flex flex-col items-center gap-1.5 sm:gap-2">
              <IndianRupee className="h-5 w-5 sm:h-6 sm:w-6" />
              <span className="text-[10px] sm:text-sm">Cash</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-auto py-3 sm:py-4">
            <Link to="/super-admin/old-payments" className="flex flex-col items-center gap-1.5 sm:gap-2">
              <FileSpreadsheet className="h-5 w-5 sm:h-6 sm:w-6" />
              <span className="text-[10px] sm:text-sm">Old Payments</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-auto py-3 sm:py-4">
            <Link to="/admin/sales-report" className="flex flex-col items-center gap-1.5 sm:gap-2">
              <BarChart3 className="h-5 w-5 sm:h-6 sm:w-6" />
              <span className="text-[10px] sm:text-sm">Sales Report</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-auto py-3 sm:py-4">
            <Link to="/admin/payouts" className="flex flex-col items-center gap-1.5 sm:gap-2">
              <IndianRupee className="h-5 w-5 sm:h-6 sm:w-6" />
              <span className="text-[10px] sm:text-sm">Payouts</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-auto py-3 sm:py-4 hidden sm:flex">
            <Link to="/admin/members" className="flex flex-col items-center gap-1.5 sm:gap-2">
              <Users className="h-5 w-5 sm:h-6 sm:w-6" />
              <span className="text-[10px] sm:text-sm">Members</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-auto py-3 sm:py-4 hidden sm:flex">
            <Link to="/admin/locations" className="flex flex-col items-center gap-1.5 sm:gap-2">
              <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6" />
              <span className="text-[10px] sm:text-sm">Locations</span>
            </Link>
          </Button>
        </div>

        <div className="grid gap-4 sm:gap-6 lg:grid-cols-2 mb-6 sm:mb-8">
          {/* Admins Overview */}
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 sm:pb-6">
              <div>
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <Shield className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  All Admins
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Manage division administrators
                </CardDescription>
              </div>
              <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
                <Link to="/admin/admins">View All</Link>
              </Button>
            </CardHeader>
            <CardContent className="px-3 sm:px-6">
              {stats.admins.length === 0 ? (
                <p className="text-muted-foreground text-sm py-4 text-center">
                  No admins found
                </p>
              ) : (
                <div className="space-y-3 max-h-[300px] overflow-y-auto">
                  {stats.admins.slice(0, 5).map((admin) => (
                    <div key={admin.id} className="flex items-center justify-between p-2.5 sm:p-3 rounded-lg border gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate text-sm">
                          {admin.full_name || "N/A"}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {admin.division?.name || "No Division"}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                        <Badge variant={admin.is_active ? "default" : "secondary"} className="text-[10px] sm:text-xs">
                          {admin.is_active ? "Active" : "Inactive"}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => handleToggleAdmin(
                            admin.id, 
                            admin.is_active ?? true,
                            admin.full_name || "Admin"
                          )}
                        >
                          {admin.is_active ? (
                            <UserX className="h-3.5 w-3.5 text-destructive" />
                          ) : (
                            <UserCheck className="h-3.5 w-3.5 text-green-600" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Divisions Overview */}
          <Card id="divisions-overview">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 sm:pb-6">
              <div>
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <Building2 className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  All Divisions
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Division performance overview
                </CardDescription>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button variant="default" size="sm" className="flex-1 sm:flex-none" onClick={() => setDivisionDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
                <Button asChild variant="outline" size="sm" className="flex-1 sm:flex-none">
                  <Link to="/admin/admins">View All</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-3 sm:px-6">
              {stats.divisions.length === 0 ? (
                <p className="text-muted-foreground text-sm py-4 text-center">
                  No divisions found
                </p>
              ) : (
                <div className="overflow-x-auto -mx-3 sm:mx-0 max-h-[400px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs sm:text-sm sticky top-0 bg-card z-10">Division</TableHead>
                        <TableHead className="text-right text-xs sm:text-sm sticky top-0 bg-card z-10">Prog.</TableHead>
                        <TableHead className="text-right text-xs sm:text-sm hidden sm:table-cell sticky top-0 bg-card z-10">Members</TableHead>
                        <TableHead className="text-xs sm:text-sm sticky top-0 bg-card z-10">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stats.divisions.map((div) => (
                        <TableRow key={div.id}>
                          <TableCell className="font-medium text-xs sm:text-sm py-2 sm:py-4">
                            <Link to={`/admin/division/${div.id}`} className="hover:underline text-primary">
                              {div.name}
                            </Link>
                          </TableCell>
                          <TableCell className="text-right text-xs sm:text-sm py-2 sm:py-4">{div.programCount}</TableCell>
                          <TableCell className="text-right text-xs sm:text-sm py-2 sm:py-4 hidden sm:table-cell">{div.memberCount}</TableCell>
                          <TableCell className="py-2 sm:py-4">
                            <Badge variant={div.is_active ? "default" : "secondary"} className="text-[10px] sm:text-xs">
                              {div.is_active ? "Active" : "Off"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="pb-3 sm:pb-6">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              Recent Activity
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Latest system activity logs
            </CardDescription>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            {stats.recentActivity.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4 text-center">
                No recent activity
              </p>
            ) : (
              <div className="space-y-3">
                {stats.recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3 p-2.5 sm:p-3 rounded-lg border">
                    <div className={`p-1.5 sm:p-2 rounded-full flex-shrink-0 ${
                      activity.type === "registration" 
                        ? "bg-green-100 dark:bg-green-900/30" 
                        : activity.type === "program"
                        ? "bg-blue-100 dark:bg-blue-900/30"
                        : "bg-amber-100 dark:bg-amber-900/30"
                    }`}>
                      {activity.type === "registration" ? (
                        <ClipboardList className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-600 dark:text-green-400" />
                      ) : activity.type === "program" ? (
                        <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600 dark:text-blue-400" />
                      ) : (
                        <Shield className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-600 dark:text-amber-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm">{activity.description}</p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                        {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {stats.error && (
          <div className="mt-4 p-4 bg-destructive/10 text-destructive rounded-lg">
            Error loading stats: {stats.error}
          </div>
        )}
      </div>

      <DivisionFormDialog
        open={divisionDialogOpen}
        onOpenChange={setDivisionDialogOpen}
        onSubmit={handleCreateDivision}
      />
    </Layout>
  );
}
