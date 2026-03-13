import { useState } from "react";
import { Search, Phone, CheckCircle2, XCircle, Loader2, IndianRupee, User, MapPin, Building2, Users, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { AgentWorkLog } from "./AgentWorkLog";

interface CollectionResult {
  id: string;
  person_name: string;
  mobile: string;
  amount: number;
  status: string;
  receipt_number: string | null;
  created_at: string;
  panchayath_name: string | null;
  division?: { name: string } | null;
}

interface OldPaymentResult {
  id: string;
  name: string;
  mobile: string;
  category: string;
  fee_paid: number;
  approved_by: string;
  approved_date: string;
}

interface AgentResult {
  id: string;
  name: string;
  mobile: string;
  role: string;
  ward: string;
  customer_count: number;
  parent_agent_id: string | null;
  panchayath?: { name: string } | null;
}

const ROLE_LABELS: Record<string, string> = {
  team_leader: "Team Leader",
  coordinator: "Coordinator",
  group_leader: "Group Leader",
  pro: "PRO",
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  pending: { label: "Pending", color: "bg-yellow-100 text-yellow-800", icon: XCircle },
  verified: { label: "Verified", color: "bg-blue-100 text-blue-800", icon: CheckCircle2 },
  submitted: { label: "Submitted to Office", color: "bg-green-100 text-green-800", icon: CheckCircle2 },
};

export function CheckStatusSection() {
  const [mobile, setMobile] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [collections, setCollections] = useState<CollectionResult[]>([]);
  const [oldPayments, setOldPayments] = useState<OldPaymentResult[]>([]);
  const [agentInfo, setAgentInfo] = useState<AgentResult | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const handleSearch = async () => {
    const cleaned = mobile.replace(/\D/g, "");
    if (cleaned.length < 10) return;

    setIsSearching(true);
    setSearched(false);

    try {
      // Search cash collections by mobile across all divisions
      const { data: collData } = await supabase
        .from("cash_collections")
        .select("id, person_name, mobile, amount, status, receipt_number, created_at, panchayath_name, division_id")
        .eq("mobile", cleaned)
        .order("created_at", { ascending: false });

      // If we got collections, fetch division names
      let collectionsWithDivision: CollectionResult[] = [];
      if (collData && collData.length > 0) {
        const divisionIds = [...new Set(collData.map(c => c.division_id))];
        const { data: divisions } = await supabase
          .from("divisions")
          .select("id, name")
          .in("id", divisionIds);

        const divMap = new Map(divisions?.map(d => [d.id, d.name]) || []);
        collectionsWithDivision = collData.map(c => ({
          ...c,
          division: divMap.has(c.division_id) ? { name: divMap.get(c.division_id)! } : null,
        }));
      }

      setCollections(collectionsWithDivision);

      // Search pennyekart agents by mobile
      const [agentRes, oldPayRes] = await Promise.all([
        supabase
          .from("pennyekart_agents")
          .select("id, name, mobile, role, ward, customer_count, parent_agent_id, panchayath:panchayaths(name)")
          .eq("mobile", cleaned)
          .eq("is_active", true)
          .limit(1),
        supabase
          .from("old_payments")
          .select("id, name, mobile, category, fee_paid, approved_by, approved_date")
          .eq("mobile", cleaned)
          .order("approved_date", { ascending: false }),
      ]);

      setAgentInfo(agentRes.data && agentRes.data.length > 0 ? (agentRes.data[0] as unknown as AgentResult) : null);
      setOldPayments((oldPayRes.data as unknown as OldPaymentResult[]) || []);

      // Fetch wallet balance if agent found
      if (agentRes.data && agentRes.data.length > 0) {
        const agentId = agentRes.data[0].id;
        const { data: walletData } = await supabase
          .from("agent_wallet_transactions")
          .select("amount")
          .eq("agent_id", agentId);
        if (walletData) {
          const balance = walletData.reduce((sum: number, t: any) => sum + Number(t.amount), 0);
          setWalletBalance(balance);
        }
      } else {
        setWalletBalance(null);
      }
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setIsSearching(false);
      setSearched(true);
    }
  };

  const hasResults = collections.length > 0 || oldPayments.length > 0 || agentInfo;

  return (
    <section className="py-12 lg:py-16 bg-muted/30">
      <div className="container mx-auto px-4 max-w-2xl">
        <div className="text-center mb-8">
          <h2 className="text-2xl lg:text-3xl font-bold text-foreground mb-2">
            Check Your Payment Status
          </h2>
          <p className="text-muted-foreground text-sm lg:text-base">
            Enter your mobile number to check your cash collection status and agent details
          </p>
        </div>

        {/* Search Input */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="tel"
                  placeholder="Enter mobile number..."
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="pl-10"
                  maxLength={15}
                />
              </div>
              <Button
                onClick={handleSearch}
                disabled={isSearching || mobile.replace(/\D/g, "").length < 10}
              >
                {isSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                <span className="ml-1.5 hidden sm:inline">Check</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {searched && (
          <div className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-4 duration-300">
            {!hasResults ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <XCircle className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p className="font-medium">No records found</p>
                  <p className="text-sm">No payment records or agent details found for this mobile number</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Cash Collections */}
                {collections.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <IndianRupee className="h-4 w-4 text-primary" />
                        Payment Records ({collections.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {collections.map((c) => {
                        const statusCfg = STATUS_CONFIG[c.status] || STATUS_CONFIG.pending;
                        return (
                          <div
                            key={c.id}
                            className="flex items-start justify-between gap-3 p-3 rounded-lg border bg-card"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm">{c.person_name}</span>
                                <Badge className={`text-[10px] px-1.5 py-0 ${statusCfg.color}`}>
                                  {statusCfg.label}
                                </Badge>
                              </div>
                              <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                                {c.receipt_number && <p>Receipt: {c.receipt_number}</p>}
                                {c.division?.name && <p>Division: {c.division.name}</p>}
                                {c.panchayath_name && <p>Panchayath: {c.panchayath_name}</p>}
                                <p>{new Date(c.created_at).toLocaleDateString("en-IN")}</p>
                              </div>
                            </div>
                            <span className="font-bold text-sm whitespace-nowrap">
                              ₹{Number(c.amount).toLocaleString("en-IN")}
                            </span>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                )}

                {/* Old Payment Records */}
                {oldPayments.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <IndianRupee className="h-4 w-4 text-primary" />
                        Previous Payment Records ({oldPayments.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {oldPayments.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-start justify-between gap-3 p-3 rounded-lg border bg-card"
                        >
                          <div className="min-w-0 flex-1">
                            <span className="font-medium text-sm">{p.name}</span>
                            <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                              {p.category && <p>Category: {p.category}</p>}
                              {p.approved_by && <p>Approved By: {p.approved_by}</p>}
                              {p.approved_date && <p>Date: {p.approved_date}</p>}
                            </div>
                          </div>
                          {p.fee_paid > 0 && (
                            <span className="font-bold text-sm whitespace-nowrap">
                              ₹{Number(p.fee_paid).toLocaleString("en-IN")}
                            </span>
                          )}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Wallet Balance */}
                {agentInfo && walletBalance !== null && (
                  <Card className="border-primary/20">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Wallet className="h-4 w-4 text-primary" />
                        Wallet Balance
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                        <div>
                          <p className="text-sm text-muted-foreground">Available Balance</p>
                          <p className="font-medium text-sm">{agentInfo.name}</p>
                        </div>
                        <span className="text-2xl font-bold text-primary">
                          ₹{walletBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Agent Info + Work Log */}
                {agentInfo && (
                  <AgentWorkLog agent={agentInfo} />
                )}
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
