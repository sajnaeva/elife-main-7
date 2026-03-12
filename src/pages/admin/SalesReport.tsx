import { useState, useEffect, useMemo, useCallback } from "react";
import { Layout } from "@/components/layout/Layout";
import { useAuth } from "@/hooks/useAuth";
import { syncPennyekartData, loadCachedData } from "@/lib/pennyekartSync";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Link, Navigate } from "react-router-dom";
import {
  ArrowLeft, Loader2, RefreshCw, CheckCircle2, FileSpreadsheet, FileText,
  ShoppingCart, IndianRupee, TrendingUp, TrendingDown, Wallet, DollarSign,
  RotateCcw,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface Order {
  id: string;
  total_amount: number;
  status: string;
  source_created_at?: string;
  customer_name?: string;
  customer_phone?: string;
  items?: any;
  payment_method?: string;
  delivery_address?: string;
  collected_amount?: number;
  godown?: string;
  panchayath_name?: string;
  ward?: string;
  district?: string;
  cost_amount?: number;
  profit_amount?: number;
  raw_data?: any;
}

interface Product {
  id: string;
  name: string;
  price: number;
  mrp: number;
  purchase_rate: number;
  category: string;
  stock: number;
  is_active: boolean;
}

const STATUS_OPTIONS = ["All", "delivered", "pending", "processing", "cancelled", "returned"];

function getItemCount(items: any): number {
  if (Array.isArray(items)) return items.length;
  if (items && typeof items === "object") return Object.keys(items).length;
  return 0;
}

function calcOrderCost(order: Order, productsMap: Map<string, Product>): number {
  if (order.cost_amount && order.cost_amount > 0) return order.cost_amount;
  if (!order.items) return 0;
  const itemsArr = Array.isArray(order.items) ? order.items : [];
  return itemsArr.reduce((sum: number, item: any) => {
    const product = productsMap.get(item.product_id || item.id);
    const qty = item.quantity || item.qty || 1;
    const cost = product?.purchase_rate || item.purchase_rate || item.cost || 0;
    return sum + cost * qty;
  }, 0);
}

export default function SalesReport() {
  const { roles, isLoading: authLoading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(null);

  // Filters
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("delivered");
  const [godownFilter, setGodownFilter] = useState("all");
  const [districtFilter, setDistrictFilter] = useState("all");
  const [panchayathFilter, setPanchayathFilter] = useState("all");
  const [wardFilter, setWardFilter] = useState("all");

  const loadCached = useCallback(async () => {
    setLoading(true);
    try {
      const cached = await loadCachedData();
      setOrders(cached.orders);
      setProducts(cached.products);
      if (cached.orders.length > 0) {
        const syncTime = (cached.orders[0] as any).synced_at;
        if (syncTime) setLastSynced(new Date(syncTime).toLocaleString("en-IN"));
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      const result = await syncPennyekartData();
      if (result.error) {
        toast.error("Sync partially failed: " + result.error);
      } else {
        toast.success(`Synced ${result.orders.length} orders, ${result.products.length} products`);
      }
      await loadCached();
    } catch (err: any) {
      toast.error("Sync failed: " + (err.message || "Unknown error"));
    } finally {
      setSyncing(false);
    }
  }, [loadCached]);

  useEffect(() => {
    loadCached().then(() => handleSync());
  }, []);

  const productsMap = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach(p => map.set(p.id, p));
    return map;
  }, [products]);

  // Unique filter options
  const godowns = useMemo(() => [...new Set(orders.map(o => o.godown).filter(Boolean))] as string[], [orders]);
  const districts = useMemo(() => [...new Set(orders.map(o => o.district).filter(Boolean))] as string[], [orders]);
  const panchayaths = useMemo(() => {
    let filtered = orders;
    if (districtFilter !== "all") filtered = filtered.filter(o => o.district === districtFilter);
    return [...new Set(filtered.map(o => o.panchayath_name).filter(Boolean))] as string[];
  }, [orders, districtFilter]);
  const wards = useMemo(() => {
    let filtered = orders;
    if (panchayathFilter !== "all") filtered = filtered.filter(o => o.panchayath_name === panchayathFilter);
    return [...new Set(filtered.map(o => o.ward).filter(Boolean))] as string[];
  }, [orders, panchayathFilter]);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      if (statusFilter !== "All" && o.status !== statusFilter) return false;
      if (fromDate && o.source_created_at && new Date(o.source_created_at) < new Date(fromDate)) return false;
      if (toDate && o.source_created_at && new Date(o.source_created_at) > new Date(toDate + "T23:59:59")) return false;
      if (godownFilter !== "all" && o.godown !== godownFilter) return false;
      if (districtFilter !== "all" && o.district !== districtFilter) return false;
      if (panchayathFilter !== "all" && o.panchayath_name !== panchayathFilter) return false;
      if (wardFilter !== "all" && o.ward !== wardFilter) return false;
      return true;
    });
  }, [orders, statusFilter, fromDate, toDate, godownFilter, districtFilter, panchayathFilter, wardFilter]);

  // Stats
  const stats = useMemo(() => {
    const totalOrders = filteredOrders.length;
    const salesAmount = filteredOrders.reduce((s, o) => s + (o.total_amount || 0), 0);
    const collected = filteredOrders.reduce((s, o) => s + (o.collected_amount || o.total_amount || 0), 0);
    const purchaseCost = filteredOrders.reduce((s, o) => s + calcOrderCost(o, productsMap), 0);
    const grossProfit = salesAmount - purchaseCost;
    const netProfit = collected - purchaseCost;
    return { totalOrders, salesAmount, collected, purchaseCost, grossProfit, netProfit };
  }, [filteredOrders, productsMap]);

  const resetFilters = () => {
    setFromDate("");
    setToDate("");
    setStatusFilter("delivered");
    setGodownFilter("all");
    setDistrictFilter("all");
    setPanchayathFilter("all");
    setWardFilter("all");
  };

  // Export to Excel
  const exportExcel = () => {
    const rows = filteredOrders.map((o, i) => ({
      "#": i + 1,
      "Order ID": o.id.substring(0, 10),
      "Date": o.source_created_at ? new Date(o.source_created_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" }) : "",
      "Customer": o.customer_name || "",
      "Items": getItemCount(o.items) + " item(s)",
      "Sales ₹": o.total_amount || 0,
      "Collected ₹": o.collected_amount || o.total_amount || 0,
      "Cost ₹": calcOrderCost(o, productsMap),
      "Profit ₹": (o.total_amount || 0) - calcOrderCost(o, productsMap),
      "Status": o.status || "",
      "Godown": o.godown || "",
      "Panchayath": o.panchayath_name || "",
      "Ward": o.ward || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = Object.keys(rows[0] || {}).map(() => ({ wch: 16 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sales Report");
    XLSX.writeFile(wb, `Sales_Report_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  // Export to PDF (print)
  const exportPdf = () => {
    const html = `<!DOCTYPE html><html><head><title>Sales Report</title>
<style>
body{font-family:Arial,sans-serif;margin:20px;font-size:11px;color:#333}
h1{font-size:18px;margin-bottom:4px}
.meta{color:#666;margin-bottom:12px;font-size:10px}
.stats{display:flex;gap:16px;margin-bottom:16px;flex-wrap:wrap}
.stat{border:1px solid #e5e7eb;border-radius:8px;padding:8px 14px;min-width:120px}
.stat-label{font-size:10px;color:#888}
.stat-value{font-size:16px;font-weight:bold}
table{border-collapse:collapse;width:100%}
th{background:#f3f4f6;text-align:left;padding:5px 6px;border:1px solid #d1d5db;font-size:10px;white-space:nowrap}
td{padding:4px 6px;border:1px solid #e5e7eb;font-size:10px}
tr:nth-child(even){background:#f9fafb}
.profit{color:#16a34a}.loss{color:#dc2626}
@media print{body{margin:10px}}
</style></head><body>
<h1>Sales Report</h1>
<div class="meta">Generated on ${new Date().toLocaleString("en-IN")}</div>
<div class="stats">
<div class="stat"><div class="stat-label">Total Orders</div><div class="stat-value">${stats.totalOrders}</div></div>
<div class="stat"><div class="stat-label">Sales Amount</div><div class="stat-value">₹${stats.salesAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</div></div>
<div class="stat"><div class="stat-label">Collected</div><div class="stat-value">₹${stats.collected.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</div></div>
<div class="stat"><div class="stat-label">Purchase Cost</div><div class="stat-value">₹${stats.purchaseCost.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</div></div>
<div class="stat"><div class="stat-label">Gross Profit</div><div class="stat-value">₹${stats.grossProfit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</div></div>
<div class="stat"><div class="stat-label">Net Profit</div><div class="stat-value">₹${stats.netProfit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</div></div>
</div>
<table><thead><tr><th>#</th><th>Order ID</th><th>Date</th><th>Customer</th><th>Items</th><th>Sales ₹</th><th>Collected ₹</th><th>Cost ₹</th><th>Profit ₹</th><th>Status</th><th>Godown</th><th>Panchayath</th><th>Ward</th></tr></thead><tbody>
${filteredOrders.map((o, i) => {
  const cost = calcOrderCost(o, productsMap);
  const profit = (o.total_amount || 0) - cost;
  return `<tr><td>${i + 1}</td><td>${o.id.substring(0, 10)}</td><td>${o.source_created_at ? new Date(o.source_created_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" }) : ""}</td><td>${o.customer_name || ""}</td><td>${getItemCount(o.items)} item(s)</td><td>₹${(o.total_amount || 0).toFixed(2)}</td><td>₹${(o.collected_amount || o.total_amount || 0).toFixed(2)}</td><td>₹${cost.toFixed(2)}</td><td class="${profit >= 0 ? "profit" : "loss"}">₹${profit.toFixed(2)}</td><td>${o.status || ""}</td><td>${o.godown || ""}</td><td>${o.panchayath_name || ""}</td><td>${o.ward || ""}</td></tr>`;
}).join("")}
</tbody></table></body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); w.onload = () => w.print(); }
  };

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!roles.includes("super_admin")) {
    return <Navigate to="/unauthorized" replace />;
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link to="/super-admin">
              <Button variant="outline" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Sales Report</h1>
              {lastSynced && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-green-500" /> Last synced: {lastSynced}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleSync} disabled={syncing} size="sm">
              <RefreshCw className={`h-4 w-4 mr-1 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing..." : "Sync"}
            </Button>
            <Button variant="outline" size="sm" onClick={exportExcel} disabled={filteredOrders.length === 0}>
              <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
            </Button>
            <Button variant="outline" size="sm" onClick={exportPdf} disabled={filteredOrders.length === 0}>
              <FileText className="h-4 w-4 mr-1" /> PDF
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="font-semibold text-sm text-foreground">Filters</h3>
            <div className="flex flex-wrap gap-3 items-end">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">From</label>
                <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-[140px] h-9" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">To</label>
                <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-[140px] h-9" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[130px] h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s === "All" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {godowns.length > 0 && (
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Godown</label>
                  <Select value={godownFilter} onValueChange={setGodownFilter}>
                    <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Godowns</SelectItem>
                      {godowns.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {districts.length > 0 && (
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">District</label>
                  <Select value={districtFilter} onValueChange={v => { setDistrictFilter(v); setPanchayathFilter("all"); setWardFilter("all"); }}>
                    <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Districts</SelectItem>
                      {districts.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {panchayaths.length > 0 && (
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Panchayath</label>
                  <Select value={panchayathFilter} onValueChange={v => { setPanchayathFilter(v); setWardFilter("all"); }}>
                    <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Panchayaths</SelectItem>
                      {panchayaths.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {wards.length > 0 && (
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Ward</label>
                  <Select value={wardFilter} onValueChange={setWardFilter}>
                    <SelectTrigger className="w-[110px] h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Wards</SelectItem>
                      {wards.map(w => <SelectItem key={w} value={w}>{w}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button variant="ghost" size="sm" onClick={resetFilters} className="h-9">
                <RotateCcw className="h-3 w-3 mr-1" /> Reset Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {loading && orders.length === 0 ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <StatCard icon={ShoppingCart} label="Total Orders" value={stats.totalOrders.toString()} color="text-amber-600" />
              <StatCard icon={IndianRupee} label="Sales Amount" value={`₹${stats.salesAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`} color="text-amber-600" />
              <StatCard icon={Wallet} label="Collected" value={`₹${stats.collected.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`} color="text-amber-600" subtitle="After coupon/wallet" />
              <StatCard icon={DollarSign} label="Purchase Cost" value={`₹${stats.purchaseCost.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`} color="text-foreground" />
              <StatCard icon={TrendingUp} label="Gross Profit" value={`₹${stats.grossProfit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`} color="text-green-600" />
              <StatCard icon={TrendingDown} label="Net Profit" value={`₹${stats.netProfit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`} color="text-green-600" subtitle="After all deductions" />
            </div>

            {/* Orders Table */}
            <Card>
              <CardContent className="p-0">
                <div className="p-4 border-b">
                  <h3 className="font-semibold text-foreground">Orders ({filteredOrders.length})</h3>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order ID</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Items</TableHead>
                        <TableHead className="text-right">Sales ₹</TableHead>
                        <TableHead className="text-right">Collected ₹</TableHead>
                        <TableHead className="text-right">Cost ₹</TableHead>
                        <TableHead className="text-right">Profit ₹</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Godown</TableHead>
                        <TableHead>Panchayath</TableHead>
                        <TableHead>Ward</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOrders.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={12} className="text-center text-muted-foreground py-12">
                            No orders found matching filters
                          </TableCell>
                        </TableRow>
                      ) : filteredOrders.map((order) => {
                        const cost = calcOrderCost(order, productsMap);
                        const profit = (order.total_amount || 0) - cost;
                        return (
                          <TableRow key={order.id}>
                            <TableCell className="font-mono text-xs">{order.id.substring(0, 8)}...</TableCell>
                            <TableCell className="text-xs whitespace-nowrap">
                              {order.source_created_at
                                ? new Date(order.source_created_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })
                                : "—"}
                            </TableCell>
                            <TableCell>{order.customer_name || "—"}</TableCell>
                            <TableCell>{getItemCount(order.items)} item(s)</TableCell>
                            <TableCell className="text-right">₹{(order.total_amount || 0).toFixed(2)}</TableCell>
                            <TableCell className="text-right">₹{(order.collected_amount || order.total_amount || 0).toFixed(2)}</TableCell>
                            <TableCell className="text-right">₹{cost.toFixed(2)}</TableCell>
                            <TableCell className={`text-right font-medium ${profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                              ₹{profit.toFixed(2)}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={order.status === "delivered" ? "default" : "outline"}
                                className={order.status === "delivered" ? "bg-green-600 hover:bg-green-700" : ""}
                              >
                                {order.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">{order.godown || "—"}</TableCell>
                            <TableCell className="text-xs">{order.panchayath_name || "—"}</TableCell>
                            <TableCell>{order.ward || "—"}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </Layout>
  );
}

function StatCard({ icon: Icon, label, value, color, subtitle }: {
  icon: any; label: string; value: string; color: string; subtitle?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Icon className={`h-4 w-4 ${color}`} />
          <span className="text-xs text-muted-foreground font-medium">{label}</span>
        </div>
        <p className={`text-xl font-bold ${color}`}>{value}</p>
        {subtitle && <p className="text-[10px] text-muted-foreground mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}
