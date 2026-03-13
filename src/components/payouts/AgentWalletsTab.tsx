import { useState, useEffect, useMemo, useCallback } from "react";
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
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Loader2, Wallet, Send, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { ROLE_LABELS, ROLE_HIERARCHY, type AgentRole } from "@/hooks/usePennyekartAgents";

interface PayoutRow {
  agent_id: string;
  agent_name: string;
  agent_mobile: string;
  role: AgentRole;
  panchayath_name: string;
  ward: string;
  commission_amount: number;
}

interface WalletTransaction {
  id: string;
  agent_id: string;
  amount: number;
  transfer_date: string;
  from_date: string | null;
  to_date: string | null;
  created_at: string;
  description: string | null;
}

interface AgentWalletsTabProps {
  payouts: PayoutRow[];
  fromDate: string;
  toDate: string;
  fmt: (n: number) => string;
}

export function AgentWalletsTab({ payouts, fromDate, toDate, fmt }: AgentWalletsTabProps) {
  const [walletTransactions, setWalletTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [transferring, setTransferring] = useState(false);
  const [panchayathFilter, setPanchayathFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");

  const loadWalletTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("agent_wallet_transactions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setWalletTransactions((data || []) as unknown as WalletTransaction[]);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWalletTransactions();
  }, [loadWalletTransactions]);

  // Aggregate payouts per agent
  const agentPayouts = useMemo(() => {
    const map: Record<string, { agent_id: string; agent_name: string; agent_mobile: string; role: AgentRole; panchayath_name: string; total_commission: number }> = {};
    payouts.forEach((p) => {
      if (!map[p.agent_id]) {
        map[p.agent_id] = {
          agent_id: p.agent_id,
          agent_name: p.agent_name,
          agent_mobile: p.agent_mobile,
          role: p.role,
          panchayath_name: p.panchayath_name,
          total_commission: 0,
        };
      }
      map[p.agent_id].total_commission += p.commission_amount;
    });
    return Object.values(map);
  }, [payouts]);

  // Check which agents already have transfers for this date range
  const existingTransfers = useMemo(() => {
    const set = new Set<string>();
    walletTransactions.forEach((t) => {
      if (t.from_date === fromDate && t.to_date === toDate) {
        set.add(t.agent_id);
      }
    });
    return set;
  }, [walletTransactions, fromDate, toDate]);

  // Wallet balances per agent
  const walletBalances = useMemo(() => {
    const map: Record<string, number> = {};
    walletTransactions.forEach((t) => {
      map[t.agent_id] = (map[t.agent_id] || 0) + Number(t.amount);
    });
    return map;
  }, [walletTransactions]);

  // Filter
  const filteredAgentPayouts = useMemo(() => {
    return agentPayouts.filter((a) => {
      if (panchayathFilter !== "all" && a.panchayath_name !== panchayathFilter) return false;
      if (roleFilter !== "all" && a.role !== roleFilter) return false;
      return true;
    });
  }, [agentPayouts, panchayathFilter, roleFilter]);

  const panchayathOptions = useMemo(() => {
    return [...new Set(agentPayouts.map((a) => a.panchayath_name))].sort();
  }, [agentPayouts]);

  const pendingTransfers = filteredAgentPayouts.filter((a) => !existingTransfers.has(a.agent_id) && a.total_commission > 0);
  const alreadyTransferred = filteredAgentPayouts.filter((a) => existingTransfers.has(a.agent_id));

  const canTransfer = fromDate && toDate && pendingTransfers.length > 0;

  // Check if transfer date is in the past (block past-date transfers)
  const today = new Date().toISOString().split("T")[0];
  const isDateRangeValid = fromDate && toDate && fromDate <= toDate;
  const isPastTransferBlocked = toDate && toDate < today;

  const handleBulkTransfer = async () => {
    if (!fromDate || !toDate) {
      toast.error("Please set From Date and To Date in the Calculate Payouts tab first");
      return;
    }
    if (isPastTransferBlocked) {
      toast.error("Cannot transfer for past date ranges. This prevents duplicate wallet transfers.");
      return;
    }

    setTransferring(true);
    try {
      const records = pendingTransfers.map((a) => ({
        agent_id: a.agent_id,
        amount: a.total_commission,
        transaction_type: "commission_credit",
        description: `Commission for ${fromDate} to ${toDate}`,
        transfer_date: today,
        from_date: fromDate,
        to_date: toDate,
      }));

      const { error } = await supabase
        .from("agent_wallet_transactions")
        .insert(records);

      if (error) {
        if (error.code === "23505") {
          toast.error("Some transfers already exist for this date range");
        } else {
          throw error;
        }
      } else {
        toast.success(`Transferred commissions to ${records.length} agent wallets`);
        loadWalletTransactions();
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setTransferring(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Status Banner */}
      {!fromDate || !toDate ? (
        <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-800">
          <CardContent className="pt-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              Set date filters in the <strong>Calculate Payouts</strong> tab first to see commission amounts.
            </p>
          </CardContent>
        </Card>
      ) : isPastTransferBlocked ? (
        <Card className="border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800">
          <CardContent className="pt-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <p className="text-sm text-red-800 dark:text-red-200">
              Transfer blocked: The "To Date" ({toDate}) is in the past. Only current or future date ranges can be transferred to prevent duplicates.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {/* Filters & Transfer Button */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="text-xs text-muted-foreground">Date Range</label>
              <p className="text-sm font-medium text-foreground">
                {fromDate || "Not set"} → {toDate || "Not set"}
              </p>
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
            <div className="ml-auto">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button disabled={!canTransfer || !!isPastTransferBlocked || transferring}>
                    {transferring ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
                    Transfer to Wallets ({pendingTransfers.length})
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirm Wallet Transfer</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will credit commissions to {pendingTransfers.length} agent wallets for the period {fromDate} to {toDate}. 
                      Total amount: {fmt(pendingTransfers.reduce((s, a) => s + a.total_commission, 0))}. 
                      This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleBulkTransfer}>Confirm Transfer</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <Wallet className="h-8 w-8 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Pending Transfers</p>
              <p className="text-xl font-bold text-foreground">{pendingTransfers.length}</p>
              <p className="text-xs text-muted-foreground">{fmt(pendingTransfers.reduce((s, a) => s + a.total_commission, 0))}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
            <div>
              <p className="text-xs text-muted-foreground">Already Transferred</p>
              <p className="text-xl font-bold text-foreground">{alreadyTransferred.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <Wallet className="h-8 w-8 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Total Wallet Balance (all agents)</p>
              <p className="text-xl font-bold text-foreground">
                {fmt(Object.values(walletBalances).reduce((s, v) => s + v, 0))}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Agents Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Agent Wallet Status</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Panchayath</TableHead>
                  <TableHead className="text-right">Commission</TableHead>
                  <TableHead className="text-right">Wallet Balance</TableHead>
                  <TableHead>Transfer Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAgentPayouts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No agents with commissions for this period.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAgentPayouts.map((a) => {
                    const transferred = existingTransfers.has(a.agent_id);
                    return (
                      <TableRow key={a.agent_id}>
                        <TableCell>
                          <div>
                            <span className="font-medium text-foreground">{a.agent_name}</span>
                            <p className="text-xs text-muted-foreground">{a.agent_mobile}</p>
                          </div>
                        </TableCell>
                        <TableCell><Badge variant="secondary">{ROLE_LABELS[a.role]}</Badge></TableCell>
                        <TableCell className="text-foreground">{a.panchayath_name}</TableCell>
                        <TableCell className="text-right font-semibold text-primary">{fmt(a.total_commission)}</TableCell>
                        <TableCell className="text-right text-foreground">{fmt(walletBalances[a.agent_id] || 0)}</TableCell>
                        <TableCell>
                          {transferred ? (
                            <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Transferred
                            </Badge>
                          ) : a.total_commission > 0 ? (
                            <Badge variant="outline" className="text-yellow-700 border-yellow-300">
                              Pending
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">No commission</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
