import { Layout } from "@/components/layout/Layout";
import { useAuth } from "@/hooks/useAuth";
import { useAdminStats } from "@/hooks/useAdminStats";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { RegistrationsDialog } from "@/components/dashboard/RegistrationsDialog";
import { AccessibleDivisionsCard } from "@/components/dashboard/AccessibleDivisionsCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  Calendar, 
  Users, 
  ClipboardList, 
  TrendingUp,
  MapPin,
  Layers,
  ArrowRight,
  LogOut,
  Shield,
  Loader2,
  Building2,
  Clock,
  ExternalLink,
  Network,
  IndianRupee
} from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

interface DivisionInfo {
  id: string;
  name: string;
  description: string | null;
}

interface PanchayathFilter {
  id: string;
  name: string;
}

export default function AdminDashboard() {
  const { isAdmin, isSuperAdmin, signOut, adminData, adminToken, user } = useAuth();
  const stats = useAdminStats();
  const [divisionInfo, setDivisionInfo] = useState<DivisionInfo | null>(null);
  const [registrationsDialogOpen, setRegistrationsDialogOpen] = useState(false);
  const [panchayathFilter, setPanchayathFilter] = useState<PanchayathFilter | null>(null);

  useEffect(() => {
    const fetchDivisionInfo = async () => {
      if (adminData?.division_id) {
        const { data } = await supabase
          .from("divisions")
          .select("id, name, description")
          .eq("id", adminData.division_id)
          .maybeSingle();
        
        if (data) {
          setDivisionInfo(data);
        }
      }
    };

    fetchDivisionInfo();
  }, [adminData]);

  // Redirect super admins to their dashboard
  if (isSuperAdmin) {
    return <Navigate to="/super-admin" replace />;
  }

  // Redirect non-admins
  if (!isAdmin) {
    return <Navigate to="/unauthorized" replace />;
  }

  const getDisplayName = () => {
    if (adminData?.full_name) {
      return adminData.full_name;
    }
    if (adminToken && divisionInfo) {
      return `Admin - ${divisionInfo.name}`;
    }
    return user?.email || "User";
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
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Admin Dashboard</h1>
              <p className="text-sm sm:text-base text-muted-foreground">
                Welcome back, {getDisplayName()}
              </p>
              {divisionInfo && (
                <div className="flex items-center gap-2 mt-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  <span className="text-sm text-primary font-medium">
                    {divisionInfo.name}
                  </span>
                  {adminData?.access_all_divisions && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-medium">
                      All Divisions
                    </span>
                  )}
                  {!adminData?.access_all_divisions && (adminData?.additional_division_ids?.length ?? 0) > 0 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-medium">
                      +{adminData?.additional_division_ids?.length} Divisions
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs sm:text-sm font-medium">
                <Shield className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                Admin
              </span>
              <Button variant="outline" size="sm" onClick={signOut} className="h-8 sm:h-9">
                <LogOut className="h-4 w-4 mr-1.5 sm:mr-2" />
                <span className="hidden xs:inline">Sign Out</span>
                <span className="xs:hidden">Exit</span>
              </Button>
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
            onClick={() => {
              setPanchayathFilter(null);
              setRegistrationsDialogOpen(true);
            }}
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
        <div className="grid gap-2 sm:gap-4 grid-cols-2 sm:grid-cols-4 mb-6 sm:mb-8">
          <Button asChild variant="outline" className="h-auto py-3 sm:py-4">
            <Link to="/admin/programs" className="flex flex-col items-center gap-1.5 sm:gap-2">
              <Calendar className="h-5 w-5 sm:h-6 sm:w-6" />
              <span className="text-xs sm:text-sm">Programs</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-auto py-3 sm:py-4">
            <Link to="/admin/members" className="flex flex-col items-center gap-1.5 sm:gap-2">
              <Users className="h-5 w-5 sm:h-6 sm:w-6" />
              <span className="text-xs sm:text-sm">Members</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-auto py-3 sm:py-4">
            <Link to="/admin/clusters" className="flex flex-col items-center gap-1.5 sm:gap-2">
              <Layers className="h-5 w-5 sm:h-6 sm:w-6" />
              <span className="text-xs sm:text-sm">Clusters</span>
            </Link>
          </Button>
          <Button asChild className="h-auto py-3 sm:py-4">
            <Link to="/admin/programs" className="flex flex-col items-center gap-1.5 sm:gap-2">
              <ArrowRight className="h-5 w-5 sm:h-6 sm:w-6" />
              <span className="text-xs sm:text-sm">New Program</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-auto py-3 sm:py-4 border-orange-200 hover:bg-orange-50 dark:border-orange-800 dark:hover:bg-orange-950">
            <Link to="/admin/pennyekart-agents" className="flex flex-col items-center gap-1.5 sm:gap-2">
              <Network className="h-5 w-5 sm:h-6 sm:w-6 text-orange-600" />
              <span className="text-xs sm:text-sm text-orange-600">Pennyekart Agents</span>
            </Link>
          </Button>
          {adminData?.cash_collection_enabled && (
            <Button asChild variant="outline" className="h-auto py-3 sm:py-4">
              <Link to={`/admin/division/${adminData?.division_id}/cash-collections`} className="flex flex-col items-center gap-1.5 sm:gap-2">
                <IndianRupee className="h-5 w-5 sm:h-6 sm:w-6" />
                <span className="text-xs sm:text-sm">Cash Collection</span>
              </Link>
            </Button>
          )}
        </div>

        {/* Accessible Divisions - only shown for admins with multi-division access */}
        {adminData && (
          <div className="mb-6 sm:mb-8">
            <AccessibleDivisionsCard
              primaryDivisionId={adminData.division_id}
              accessAllDivisions={adminData.access_all_divisions ?? false}
              additionalDivisionIds={adminData.additional_division_ids ?? []}
            />
          </div>
        )}

        <div className="grid gap-4 sm:gap-6 lg:grid-cols-2 mb-6 sm:mb-8">
          {/* Recent Registrations */}
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 sm:pb-6">
              <div>
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <ClipboardList className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  Recent Registrations
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Latest program registrations
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="px-3 sm:px-6">
              {stats.recentRegistrations.length === 0 ? (
                <p className="text-muted-foreground text-sm py-4 text-center">
                  No registrations yet
                </p>
              ) : (
                <div className="space-y-3 max-h-[300px] overflow-y-auto">
                  {stats.recentRegistrations.map((reg) => (
                    <div key={reg.id} className="flex items-start gap-3 p-2.5 sm:p-3 rounded-lg border">
                      <div className="p-1.5 sm:p-2 rounded-full bg-green-100 dark:bg-green-900/30 flex-shrink-0">
                        <ClipboardList className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-600 dark:text-green-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-xs sm:text-sm truncate">
                          {reg.registrant_name}
                        </p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                          {reg.program_name}
                        </p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                          {formatDistanceToNow(new Date(reg.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Panchayath-wise Stats */}
          <Card>
            <CardHeader className="pb-3 sm:pb-6">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <MapPin className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                Panchayath Stats
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Programs and registrations by panchayath
              </CardDescription>
            </CardHeader>
            <CardContent className="px-3 sm:px-6">
              {stats.panchayathStats.length === 0 ? (
                <p className="text-muted-foreground text-sm py-4 text-center">
                  No data available
                </p>
              ) : (
                <div className="overflow-x-auto -mx-3 sm:mx-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs sm:text-sm">Panchayath</TableHead>
                        <TableHead className="text-right text-xs sm:text-sm">Prog.</TableHead>
                        <TableHead className="text-right text-xs sm:text-sm">Reg.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stats.panchayathStats.slice(0, 5).map((stat) => (
                        <TableRow 
                          key={stat.id} 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => {
                            setPanchayathFilter({ id: stat.id, name: stat.name });
                            setRegistrationsDialogOpen(true);
                          }}
                        >
                          <TableCell className="font-medium text-xs sm:text-sm py-2 sm:py-4">
                            <div className="flex items-center gap-1">
                              {stat.name}
                              <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-xs sm:text-sm py-2 sm:py-4">{stat.programs}</TableCell>
                          <TableCell className="text-right text-xs sm:text-sm py-2 sm:py-4">{stat.registrations}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Cluster Stats - Full width */}
        <Card>
          <CardHeader className="pb-3 sm:pb-6">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Layers className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              Cluster Stats
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Member distribution by cluster
            </CardDescription>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            {stats.clusterStats.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4 text-center">
                No data available
              </p>
            ) : (
              <div className="overflow-x-auto -mx-3 sm:mx-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs sm:text-sm">Cluster</TableHead>
                      <TableHead className="text-xs sm:text-sm hidden sm:table-cell">Panchayath</TableHead>
                      <TableHead className="text-right text-xs sm:text-sm">Members</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.clusterStats.slice(0, 5).map((stat) => (
                      <TableRow key={stat.id}>
                        <TableCell className="py-2 sm:py-4">
                          <div className="font-medium text-xs sm:text-sm">{stat.name}</div>
                          <div className="text-xs text-muted-foreground sm:hidden">{stat.panchayath_name}</div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs sm:text-sm py-2 sm:py-4 hidden sm:table-cell">
                          {stat.panchayath_name}
                        </TableCell>
                        <TableCell className="text-right text-xs sm:text-sm py-2 sm:py-4">{stat.members}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {stats.error && (
          <div className="mt-4 p-4 bg-destructive/10 text-destructive rounded-lg">
            Error loading stats: {stats.error}
          </div>
        )}

        {/* Registrations Dialog */}
        <RegistrationsDialog
          open={registrationsDialogOpen}
          onOpenChange={setRegistrationsDialogOpen}
          filterPanchayathId={panchayathFilter?.id}
          filterPanchayathName={panchayathFilter?.name}
        />
      </div>
    </Layout>
  );
}
