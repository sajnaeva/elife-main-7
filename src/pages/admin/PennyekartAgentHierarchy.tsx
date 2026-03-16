import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  Plus, 
  Search, 
  Filter,
  Building2,
  Loader2,
  ArrowLeft,
  Download,
  FileSpreadsheet,
  FileText,
} from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { 
  usePennyekartAgents, 
  useAgentMutations,
  AgentFilters,
  AgentRole,
  ROLE_LABELS,
  ROLE_HIERARCHY,
  PennyekartAgent,
  getChildRole
} from "@/hooks/usePennyekartAgents";
import { AgentHierarchyTree } from "@/components/pennyekart/AgentHierarchyTree";
import { AgentProfileCard } from "@/components/pennyekart/AgentProfileCard";
import { BulkAgentFormDialog } from "@/components/pennyekart/BulkAgentFormDialog";
import { AgentDetailsPanel } from "@/components/pennyekart/AgentDetailsPanel";
import { toast } from "sonner";
import { exportAgentsToXlsx, exportAgentsToPdf } from "@/lib/exportAgents";

interface Panchayath {
  id: string;
  name: string;
}

// Pennyekart division ID - only admins of this division can access this page
const PENNYEKART_DIVISION_ID = "e108eb84-b8a2-452d-b0d4-350d0c90303b";

export default function PennyekartAgentHierarchy() {
  const { isAdmin, isSuperAdmin, adminData, isLoading: authLoading } = useAuth();
  const [filters, setFilters] = useState<AgentFilters>({});
  const [panchayaths, setPanchayaths] = useState<Panchayath[]>([]);
  const [wards, setWards] = useState<string[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<PennyekartAgent | null>(null);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<PennyekartAgent | null>(null);
  const [defaultParentId, setDefaultParentId] = useState<string | null>(null);
  const [defaultRole, setDefaultRole] = useState<AgentRole | null>(null);

  const { agents, isLoading, error, refetch } = usePennyekartAgents(filters);
  const { deleteAgent } = useAgentMutations();

  // Load panchayaths
  useEffect(() => {
    const fetchPanchayaths = async () => {
      const { data } = await supabase
        .from("panchayaths")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      setPanchayaths(data || []);
    };
    fetchPanchayaths();
  }, []);

  // Load unique wards when panchayath is selected
  useEffect(() => {
    const fetchWards = async () => {
      if (!filters.panchayath_id) {
        setWards([]);
        return;
      }

      const { data } = await supabase
        .from("pennyekart_agents")
        .select("ward")
        .eq("panchayath_id", filters.panchayath_id);

      const uniqueWards = [...new Set((data || []).map(a => a.ward))].sort();
      setWards(uniqueWards);
    };
    fetchWards();
  }, [filters.panchayath_id]);

  // Check permissions - only Pennyekart division admins, admins with access_all_divisions, or super admins
  if (authLoading) {
    return (
      <Layout>
        <div className="container py-8 flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  const isPennyekartAdmin = adminData?.division_id === PENNYEKART_DIVISION_ID
    || adminData?.access_all_divisions
    || adminData?.additional_division_ids?.includes(PENNYEKART_DIVISION_ID);
  
  if (!isSuperAdmin && !isPennyekartAdmin) {
    return <Navigate to="/unauthorized" replace />;
  }

  const handleAddAgent = () => {
    setEditingAgent(null);
    setDefaultParentId(null);
    setDefaultRole(null);
    setFormDialogOpen(true);
  };

  const handleEditAgent = (agent: PennyekartAgent) => {
    setEditingAgent(agent);
    setDefaultParentId(null);
    setDefaultRole(null);
    setFormDialogOpen(true);
  };

  const handleAddChildAgent = (parent: PennyekartAgent) => {
    const childRole = getChildRole(parent.role);
    if (!childRole) return;

    setEditingAgent(null);
    setDefaultParentId(parent.id);
    setDefaultRole(childRole);
    setFormDialogOpen(true);
  };

  const handleDeleteAgent = async (agent: PennyekartAgent) => {
    const { error } = await deleteAgent(agent.id);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Agent deleted");
    setSelectedAgent(null);
    refetch();
  };

  const handleFilterChange = (key: keyof AgentFilters, value: string | undefined) => {
    setFilters(prev => ({
      ...prev,
      [key]: value === "all" ? undefined : value
    }));
  };

  const clearFilters = () => {
    setFilters({});
  };

  // Calculate stats
  const totalAgents = agents.length;
  const byRole = ROLE_HIERARCHY.reduce((acc, role) => {
    acc[role] = agents.filter(a => a.role === role).length;
    return acc;
  }, {} as Record<AgentRole, number>);
  const totalCustomers = agents
    .filter(a => a.role === "pro")
    .reduce((sum, a) => sum + a.customer_count, 0);

  return (
    <Layout>
      <div className="container py-4 sm:py-6 max-w-full overflow-x-hidden">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
              <Link to="/admin-dashboard">
                <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 flex-shrink-0">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <h1 className="text-lg sm:text-2xl font-bold truncate">Pennyekart Agents</h1>
            </div>
            <p className="text-muted-foreground text-xs sm:text-sm ml-9 sm:ml-11">
              Manage agent network
            </p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="flex-1 sm:flex-none" disabled={agents.length === 0}>
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => exportAgentsToXlsx(agents, panchayaths)}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Export to Excel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportAgentsToPdf(agents, panchayaths)}>
                  <FileText className="h-4 w-4 mr-2" />
                  Export to PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={handleAddAgent} size="sm" className="flex-1 sm:flex-none">
              <Plus className="h-4 w-4 mr-2" />
              Add Agent
            </Button>
          </div>
        </div>

        {/* Stats - Scrollable on mobile */}
        <div className="overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 mb-4 sm:mb-6">
          <div className="flex sm:grid sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 min-w-max sm:min-w-0">
            <Card className="p-2 sm:p-3 min-w-[80px] sm:min-w-0">
              <div className="text-lg sm:text-2xl font-bold">{totalAgents}</div>
              <div className="text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap">Total</div>
            </Card>
            {ROLE_HIERARCHY.map(role => (
              <Card key={role} className="p-2 sm:p-3 min-w-[80px] sm:min-w-0">
                <div className="text-lg sm:text-2xl font-bold">{byRole[role]}</div>
                <div className="text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap">{ROLE_LABELS[role]}s</div>
              </Card>
            ))}
            <Card className="p-2 sm:p-3 min-w-[80px] sm:min-w-0">
              <div className="text-lg sm:text-2xl font-bold">{totalCustomers}</div>
              <div className="text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap">Customers</div>
            </Card>
          </div>
        </div>

        {/* Filters - Collapsible on mobile */}
        <Card className="mb-4 sm:mb-6">
          <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6 py-2 sm:py-4">
            <CardTitle className="text-sm sm:text-base flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-3 sm:pb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-3">
              <div className="relative lg:col-span-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  className="pl-9 h-9"
                  value={filters.search || ""}
                  onChange={(e) => handleFilterChange("search", e.target.value || undefined)}
                />
              </div>
              
              <Select
                value={filters.panchayath_id || "all"}
                onValueChange={(v) => handleFilterChange("panchayath_id", v)}
              >
                <SelectTrigger className="h-9">
                  <Building2 className="h-4 w-4 mr-2 text-muted-foreground flex-shrink-0" />
                  <SelectValue placeholder="Panchayath" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Panchayaths</SelectItem>
                  {panchayaths.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={filters.ward || "all"}
                onValueChange={(v) => handleFilterChange("ward", v)}
                disabled={!filters.panchayath_id}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Ward" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Wards</SelectItem>
                  {wards.map(w => (
                    <SelectItem key={w} value={w}>{w}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={filters.role || "all"}
                onValueChange={(v) => handleFilterChange("role", v as AgentRole)}
              >
                <SelectTrigger className="h-9">
                  <Users className="h-4 w-4 mr-2 text-muted-foreground flex-shrink-0" />
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {ROLE_HIERARCHY.map(role => (
                    <SelectItem key={role} value={role}>{ROLE_LABELS[role]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {Object.values(filters).some(v => v) && (
              <div className="flex items-center gap-2 mt-2 sm:mt-3">
                <span className="text-xs sm:text-sm text-muted-foreground">Active filters:</span>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clearFilters}>
                  Clear all
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* S-Code Leaders - Profile Cards */}
        {(() => {
          const scodeAgents = agents.filter(a => a.role === "scode");
          if (scodeAgents.length === 0) return null;
          return (
            <div className="mb-4 sm:mb-6">
              <h2 className="text-sm sm:text-base font-semibold mb-3 flex items-center gap-2">
                <Users className="h-4 w-4 text-rose-500" />
                S-Code Leaders
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {scodeAgents.map(agent => (
                  <AgentProfileCard
                    key={agent.id}
                    agent={agent}
                    allAgents={agents}
                    panchayaths={panchayaths}
                    onClick={() => setSelectedAgent(agent)}
                    isSelected={selectedAgent?.id === agent.id}
                  />
                ))}
              </div>
            </div>
          );
        })()}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Hierarchy Tree */}
          <Card className="lg:col-span-2 overflow-hidden">
            <CardHeader className="px-3 sm:px-6 py-3 sm:py-4">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <Users className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                Agent Hierarchy
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Click on an agent to view details
              </CardDescription>
            </CardHeader>
            <CardContent className="px-2 sm:px-6 pb-4 max-h-[50vh] sm:max-h-[60vh] overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : error ? (
                <div className="text-center py-12 text-destructive">
                  <p className="text-sm">Error: {error}</p>
                  <Button variant="outline" size="sm" className="mt-4" onClick={refetch}>
                    Retry
                  </Button>
                </div>
              ) : (
                <AgentHierarchyTree
                  agents={agents}
                  onSelectAgent={setSelectedAgent}
                  selectedAgentId={selectedAgent?.id}
                />
              )}
            </CardContent>
          </Card>

          {/* Details Panel */}
          <div className="lg:col-span-1">
            {selectedAgent ? (
              <AgentDetailsPanel
                agent={selectedAgent}
                allAgents={agents}
                panchayaths={panchayaths}
                onEdit={() => handleEditAgent(selectedAgent)}
                onDelete={() => handleDeleteAgent(selectedAgent)}
                onAddChild={() => handleAddChildAgent(selectedAgent)}
                onClose={() => setSelectedAgent(null)}
              />
            ) : (
              <Card className="h-full min-h-[200px] sm:min-h-[300px] flex items-center justify-center">
                <div className="text-center text-muted-foreground p-4 sm:p-6">
                  <Users className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 sm:mb-4 opacity-50" />
                  <p className="text-sm">Select an agent to view details</p>
                </div>
              </Card>
            )}
          </div>
        </div>

        {/* Form Dialog */}
        <BulkAgentFormDialog
          open={formDialogOpen}
          onOpenChange={setFormDialogOpen}
          agent={editingAgent}
          defaultParentId={defaultParentId}
          defaultRole={defaultRole}
          onSuccess={refetch}
        />
      </div>
    </Layout>
  );
}
