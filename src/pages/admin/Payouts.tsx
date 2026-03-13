import { useState, useEffect, useMemo, useCallback } from "react";
import { Layout } from "@/components/layout/Layout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link, Navigate } from "react-router-dom";
import {
  ArrowLeft, Loader2, IndianRupee, Save, Calculator, Users, Percent, Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { ROLE_LABELS, ROLE_HIERARCHY, type AgentRole } from "@/hooks/usePennyekartAgents";
import { AgentWalletsTab } from "@/components/payouts/AgentWalletsTab";

interface CommissionRate {
  id: string;
  role: string;
  percentage: number;
  updated_at: string;
}

interface AgentRow {
  id: string;
  name: string;
  mobile: string;
  role: AgentRole;
  panchayath_id: string;
  ward: string;
  panchayath_name?: string;
  responsible_panchayath_ids?: string[];
  responsible_wards?: string[];
}

interface PayoutRow {
  agent_id: string;
  agent_name: string;
  agent_mobile: string;
  role: AgentRole;
  panchayath_name: string;
  ward: string;
  total_sales: number;
  commission_pct: number;
  agents_sharing: number;
  commission_amount: number;
}

export default function Payouts() {
  const { roles, isSuperAdmin, isLoading: authLoading } = useAuth();
  const [rates, setRates] = useState<CommissionRate[]>([]);
  const [editRates, setEditRates] = useState<Record<string, number>>({});
  const [savingRates, setSavingRates] = useState(false);
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [panchayathFilter, setPanchayathFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");

  // Load commission rates
  const loadRates = useCallback(async () => {
    const { data } = await supabase
      .from("payout_commission_rates")
      .select("*")
      .order("role");
    if (data) {
      setRates(data as CommissionRate[]);
      const map: Record<string, number> = {};
      data.forEach((r: any) => { map[r.role] = r.percentage; });
      setEditRates(map);
    }
  }, []);

  // Load agents & orders
  // Load panchayaths for name mapping
  const [panchayaths, setPanchayaths] = useState<{ id: string; name: string; name_ml: string | null }[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [agentsRes, ordersRes, panchayathsRes] = await Promise.all([
        supabase
          .from("pennyekart_agents")
          .select("id, name, mobile, role, panchayath_id, ward, responsible_panchayath_ids, responsible_wards, panchayath:panchayaths(name)")
          .eq("is_active", true),
        supabase
          .from("pennyekart_orders")
          .select("total_amount, panchayath_name, ward, status, source_created_at"),
        supabase
          .from("panchayaths")
          .select("id, name, name_ml"),
      ]);
      if (agentsRes.data) {
        setAgents(agentsRes.data.map((a: any) => ({
          ...a,
          panchayath_name: a.panchayath?.name || "",
        })));
      }
      if (ordersRes.data) setOrders(ordersRes.data);
      if (panchayathsRes.data) setPanchayaths(panchayathsRes.data);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRates();
    loadData();
  }, [loadRates, loadData]);

  // Save commission rates
  const handleSaveRates = async () => {
    setSavingRates(true);
    try {
      for (const [role, pct] of Object.entries(editRates)) {
        await supabase
          .from("payout_commission_rates")
          .update({ percentage: pct, updated_at: new Date().toISOString() })
          .eq("role", role);
      }
      toast.success("Commission rates saved");
      loadRates();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingRates(false);
    }
  };

  // Build a map to normalize order panchayath_name to the canonical panchayath name
  const orderPanchayathToCanonical = useMemo(() => {
    const map: Record<string, string> = {};
    panchayaths.forEach((p) => {
      // Direct match
      map[p.name] = p.name;
      if (p.name_ml) map[p.name_ml] = p.name;
      // Combined format: "Name (name_ml)"
      if (p.name_ml) {
        map[`${p.name} (${p.name_ml})`] = p.name;
      }
    });
    return map;
  }, [panchayaths]);

  // Filter orders by date & status=delivered
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (o.status !== "delivered") return false;
      if (fromDate && o.source_created_at && o.source_created_at < fromDate) return false;
      if (toDate && o.source_created_at && o.source_created_at > toDate + "T23:59:59") return false;
      return true;
    });
  }, [orders, fromDate, toDate]);

  // Build sales by panchayath+ward using canonical names
  const salesMap = useMemo(() => {
    const map: Record<string, number> = {};
    filteredOrders.forEach((o) => {
      const rawP = (o.panchayath_name || "Unknown").trim();
      const p = orderPanchayathToCanonical[rawP] || rawP;
      const w = (o.ward || "Unknown").trim();
      const key = `${p}||${w}`;
      map[key] = (map[key] || 0) + (o.total_amount || 0);
      // Also aggregate at panchayath level
      const pKey = `${p}||__ALL__`;
      map[pKey] = (map[pKey] || 0) + (o.total_amount || 0);
    });
    return map;
  }, [filteredOrders, orderPanchayathToCanonical]);

  // Get panchayath names from agents for the panchayath_id->name mapping
  const panchayathIdToName = useMemo(() => {
    const map: Record<string, string> = {};
    agents.forEach((a) => {
      if (a.panchayath_id && a.panchayath_name) {
        map[a.panchayath_id] = a.panchayath_name;
      }
    });
    return map;
  }, [agents]);

  // Calculate payouts
  const payouts = useMemo(() => {
    const result: PayoutRow[] = [];

    // Group agents by role, panchayath_name, and ward
    // For group_leader and pro: commission = ward sales × pct / agents in that ward
    // For coordinator: commission = ward sales × pct / coordinators covering that ward
    // For team_leader: commission = panchayath total sales × pct / team leaders covering that panchayath

    for (const role of ROLE_HIERARCHY) {
      const pct = editRates[role] || 0;
      if (pct === 0) continue;

      const roleAgents = agents.filter((a) => a.role === role);

      if (role === "team_leader") {
        // Team leaders work at panchayath level
        // Group by panchayath - use responsible_panchayath_ids if available
        const panchayathAgentsMap: Record<string, AgentRow[]> = {};
        
        roleAgents.forEach((a) => {
          const panchayaths = a.responsible_panchayath_ids?.length
            ? a.responsible_panchayath_ids
            : [a.panchayath_id];
          
          panchayaths.forEach((pid) => {
            if (!panchayathAgentsMap[pid]) panchayathAgentsMap[pid] = [];
            panchayathAgentsMap[pid].push(a);
          });
        });

        Object.entries(panchayathAgentsMap).forEach(([pid, agentsInPanchayath]) => {
          const pName = panchayathIdToName[pid] || "Unknown";
          const salesKey = `${pName}||__ALL__`;
          const totalSales = salesMap[salesKey] || 0;
          if (totalSales === 0) return;

          const commission = (totalSales * pct) / 100;
          const perAgent = commission / agentsInPanchayath.length;

          agentsInPanchayath.forEach((a) => {
            result.push({
              agent_id: a.id,
              agent_name: a.name,
              agent_mobile: a.mobile,
              role,
              panchayath_name: pName,
              ward: "All Wards",
              total_sales: totalSales,
              commission_pct: pct,
              agents_sharing: agentsInPanchayath.length,
              commission_amount: perAgent,
            });
          });
        });
      } else if (role === "coordinator") {
        // Coordinators work at ward level, may have responsible_wards
        const wardAgentsMap: Record<string, AgentRow[]> = {};

        roleAgents.forEach((a) => {
          const wards = a.responsible_wards?.length
            ? a.responsible_wards
            : [a.ward];
          const pName = a.panchayath_name || "Unknown";

          wards.forEach((w) => {
            const key = `${pName}||${w}`;
            if (!wardAgentsMap[key]) wardAgentsMap[key] = [];
            wardAgentsMap[key].push(a);
          });
        });

        Object.entries(wardAgentsMap).forEach(([key, agentsInWard]) => {
          const totalSales = salesMap[key] || 0;
          if (totalSales === 0) return;
          const [pName, ward] = key.split("||");

          const commission = (totalSales * pct) / 100;
          const perAgent = commission / agentsInWard.length;

          agentsInWard.forEach((a) => {
            result.push({
              agent_id: a.id,
              agent_name: a.name,
              agent_mobile: a.mobile,
              role,
              panchayath_name: pName,
              ward,
              total_sales: totalSales,
              commission_pct: pct,
              agents_sharing: agentsInWard.length,
              commission_amount: perAgent,
            });
          });
        });
      } else {
        // group_leader and pro: ward level based on their own ward
        const wardAgentsMap: Record<string, AgentRow[]> = {};

        roleAgents.forEach((a) => {
          const pName = a.panchayath_name || "Unknown";
          const key = `${pName}||${a.ward}`;
          if (!wardAgentsMap[key]) wardAgentsMap[key] = [];
          wardAgentsMap[key].push(a);
        });

        Object.entries(wardAgentsMap).forEach(([key, agentsInWard]) => {
          const totalSales = salesMap[key] || 0;
          if (totalSales === 0) return;
          const [pName, ward] = key.split("||");

          const commission = (totalSales * pct) / 100;
          const perAgent = commission / agentsInWard.length;

          agentsInWard.forEach((a) => {
            result.push({
              agent_id: a.id,
              agent_name: a.name,
              agent_mobile: a.mobile,
              role,
              panchayath_name: pName,
              ward,
              total_sales: totalSales,
              commission_pct: pct,
              agents_sharing: agentsInWard.length,
              commission_amount: perAgent,
            });
          });
        });
      }
    }

    return result;
  }, [agents, salesMap, editRates, panchayathIdToName]);

  // Apply filters
  const filteredPayouts = useMemo(() => {
    return payouts.filter((p) => {
      if (panchayathFilter !== "all" && p.panchayath_name !== panchayathFilter) return false;
      if (roleFilter !== "all" && p.role !== roleFilter) return false;
      return true;
    });
  }, [payouts, panchayathFilter, roleFilter]);

  // Unique panchayath names from payouts
  const panchayathOptions = useMemo(() => {
    return [...new Set(payouts.map((p) => p.panchayath_name))].sort();
  }, [payouts]);

  // Summary stats
  const summary = useMemo(() => {
    const totalSales = filteredOrders.reduce((s, o) => s + (o.total_amount || 0), 0);
    const totalCommission = filteredPayouts.reduce((s, p) => s + p.commission_amount, 0);
    const agentCount = new Set(filteredPayouts.map((p) => p.agent_id)).size;
    return { totalSales, totalCommission, agentCount };
  }, [filteredOrders, filteredPayouts]);

  // Role-wise summary
  const roleSummary = useMemo(() => {
    const map: Record<string, { count: number; total: number }> = {};
    filteredPayouts.forEach((p) => {
      if (!map[p.role]) map[p.role] = { count: 0, total: 0 };
      map[p.role].count++;
      map[p.role].total += p.commission_amount;
    });
    return map;
  }, [filteredPayouts]);

  const fmt = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Redirect non-super-admins
  if (!authLoading && !isSuperAdmin) {
    return <Navigate to="/unauthorized" replace />;
  }

  if (authLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-7xl">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link to="/super-admin">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Agent Payouts</h1>
            <p className="text-muted-foreground text-sm">Commission calculation based on sales & agent hierarchy</p>
          </div>
        </div>

        <Tabs defaultValue="calculate" className="space-y-4">
          <TabsList>
            <TabsTrigger value="calculate"><Calculator className="h-4 w-4 mr-1" /> Calculate Payouts</TabsTrigger>
            <TabsTrigger value="wallets"><Wallet className="h-4 w-4 mr-1" /> Agent Wallets</TabsTrigger>
            <TabsTrigger value="settings"><Percent className="h-4 w-4 mr-1" /> Commission Settings</TabsTrigger>
          </TabsList>

          {/* Commission Settings Tab */}
          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Commission Rates by Role</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Set the sales commission percentage for each agent role. The commission for each ward/panchayath is divided equally among all agents of that role operating in that area.
                </p>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {ROLE_HIERARCHY.map((role) => (
                    <Card key={role} className="border">
                      <CardContent className="pt-4 space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{ROLE_LABELS[role]}</Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            value={editRates[role] ?? 0}
                            onChange={(e) => setEditRates((prev) => ({ ...prev, [role]: parseFloat(e.target.value) || 0 }))}
                            className="w-24"
                          />
                          <span className="text-sm text-muted-foreground">%</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <Button onClick={handleSaveRates} disabled={savingRates}>
                  {savingRates ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                  Save Rates
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Calculate Payouts Tab */}
          <TabsContent value="calculate" className="space-y-4">
            {/* Date Filters */}
            <Card>
              <CardContent className="pt-4">
                <div className="flex flex-wrap gap-3 items-end">
                  <div>
                    <label className="text-xs text-muted-foreground">From Date</label>
                    <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-40" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">To Date</label>
                    <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-40" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Panchayath</label>
                    <Select value={panchayathFilter} onValueChange={setPanchayathFilter}>
                      <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Panchayaths</SelectItem>
                        {panchayathOptions.map((p) => (
                          <SelectItem key={p} value={p}>{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Role</label>
                    <Select value={roleFilter} onValueChange={setRoleFilter}>
                      <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Roles</SelectItem>
                        {ROLE_HIERARCHY.map((r) => (
                          <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Summary Cards */}
            <div className="grid gap-4 sm:grid-cols-3">
              <Card>
                <CardContent className="pt-4 flex items-center gap-3">
                  <IndianRupee className="h-8 w-8 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Total Delivered Sales</p>
                    <p className="text-xl font-bold text-foreground">{fmt(summary.totalSales)}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 flex items-center gap-3">
                  <Calculator className="h-8 w-8 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Total Commission</p>
                    <p className="text-xl font-bold text-foreground">{fmt(summary.totalCommission)}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 flex items-center gap-3">
                  <Users className="h-8 w-8 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Agents with Payouts</p>
                    <p className="text-xl font-bold text-foreground">{summary.agentCount}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Role-wise Summary */}
            <div className="grid gap-3 sm:grid-cols-4">
              {ROLE_HIERARCHY.map((role) => {
                const rs = roleSummary[role];
                return (
                  <Card key={role} className="border">
                    <CardContent className="pt-3 pb-3">
                      <div className="flex justify-between items-center">
                        <Badge variant="outline">{ROLE_LABELS[role]}</Badge>
                        <span className="text-xs text-muted-foreground">{editRates[role] || 0}%</span>
                      </div>
                      <p className="text-lg font-semibold mt-1 text-foreground">{fmt(rs?.total || 0)}</p>
                      <p className="text-xs text-muted-foreground">{rs?.count || 0} payouts</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Payouts Table */}
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Agent</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Panchayath</TableHead>
                        <TableHead>Ward</TableHead>
                        <TableHead className="text-right">Ward Sales</TableHead>
                        <TableHead className="text-right">Rate</TableHead>
                        <TableHead className="text-right">Sharing</TableHead>
                        <TableHead className="text-right">Commission</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPayouts.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                            No payouts to display. Upload sales data and ensure agents are configured.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredPayouts.map((p, i) => (
                          <TableRow key={`${p.agent_id}-${p.panchayath_name}-${p.ward}-${i}`}>
                            <TableCell>
                              <div>
                                <span className="font-medium text-foreground">{p.agent_name}</span>
                                <p className="text-xs text-muted-foreground">{p.agent_mobile}</p>
                              </div>
                            </TableCell>
                            <TableCell><Badge variant="secondary">{ROLE_LABELS[p.role]}</Badge></TableCell>
                            <TableCell className="text-foreground">{p.panchayath_name}</TableCell>
                            <TableCell className="text-foreground">{p.ward}</TableCell>
                            <TableCell className="text-right text-foreground">{fmt(p.total_sales)}</TableCell>
                            <TableCell className="text-right text-foreground">{p.commission_pct}%</TableCell>
                            <TableCell className="text-right text-foreground">÷{p.agents_sharing}</TableCell>
                            <TableCell className="text-right font-semibold text-primary">{fmt(p.commission_amount)}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
