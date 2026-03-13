import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Layout } from "@/components/layout/Layout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Link, Navigate } from "react-router-dom";
import {
  ArrowLeft, Loader2, CheckCircle2, FileSpreadsheet, FileText,
  ShoppingCart, IndianRupee, TrendingUp, TrendingDown, Wallet, DollarSign,
  RotateCcw, Upload,
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
  godown_type?: string;
  panchayath_name?: string;
  ward?: string;
  district?: string;
  cost_amount?: number;
  profit_amount?: number;
  net_profit?: number;
  self_pickup?: string;
  delivery?: string;
  uploaded_at?: string;
}

const STATUS_OPTIONS = ["All", "delivered", "pending", "processing", "cancelled", "returned"];

function parseExcelDate(val: any): string {
  if (!val) return "";
  if (typeof val === "number") {
    // Excel serial date
    const date = XLSX.SSF.parse_date_code(val);
    return new Date(date.y, date.m - 1, date.d, date.H || 0, date.M || 0, date.S || 0).toISOString();
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? "" : d.toISOString();
}

export default function SalesReport() {
  const { roles, isLoading: authLoading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [lastUploaded, setLastUploaded] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filters
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("delivered");
  const [godownFilter, setGodownFilter] = useState("all");
  const [districtFilter, setDistrictFilter] = useState("all");
  const [panchayathFilter, setPanchayathFilter] = useState("all");
  const [wardFilter, setWardFilter] = useState("all");

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("pennyekart_orders")
        .select("*")
        .order("source_created_at", { ascending: false });
      if (error) throw error;
      setOrders(data || []);
      if (data && data.length > 0) {
        const latest = data.reduce((a: any, b: any) =>
          (a.uploaded_at || "") > (b.uploaded_at || "") ? a : b
        );
        if (latest.uploaded_at) setLastUploaded(new Date(latest.uploaded_at).toLocaleString("en-IN"));
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      if (rows.length === 0) {
        toast.error("No data found in Excel file");
        return;
      }

      const now = new Date().toISOString();

      // Map Excel columns to DB columns
      const mapped = rows.map((row: any) => {
        const orderId = String(row["Order ID"] || row["order_id"] || row["id"] || "").trim();
        if (!orderId) return null;

        return {
          id: orderId,
          source_created_at: parseExcelDate(row["Date"] || row["date"]) || null,
          customer_name: String(row["Customer"] || row["customer"] || row["customer_name"] || ""),
          items: row["Items"] || row["items"] || null,
          total_amount: Number(row["Sales Amount"] || row["sales_amount"] || row["total_amount"] || 0),
          collected_amount: Number(row["Collected (Amount)"] || row["Collected"] || row["collected_amount"] || 0),
          cost_amount: Number(row["Purchase Cost"] || row["purchase_cost"] || row["cost_amount"] || 0),
          profit_amount: Number(row["Gross Profit"] || row["gross_profit"] || row["profit_amount"] || 0),
          net_profit: Number(row["Net Profit"] || row["net_profit"] || 0),
          status: String(row["Status"] || row["status"] || "pending").toLowerCase(),
          godown: String(row["Godown"] || row["godown"] || ""),
          godown_type: String(row["Godown Type"] || row["godown_type"] || ""),
          panchayath_name: String(row["Panchayath"] || row["panchayath_name"] || row["panchayath"] || ""),
          district: String(row["District"] || row["district"] || ""),
          ward: String(row["Ward"] || row["ward"] || ""),
          self_pickup: String(row["Self"] || row["self_pickup"] || ""),
          delivery: String(row["Delivery"] || row["delivery"] || ""),
          synced_at: now,
          uploaded_at: now,
        };
      }).filter(Boolean);

      if (mapped.length === 0) {
        toast.error("No valid orders found. Check column headers match: Order ID, Date, Customer, etc.");
        return;
      }

      // Upsert in batches of 500
      const batchSize = 500;
      let totalUpserted = 0;
      for (let i = 0; i < mapped.length; i += batchSize) {
        const batch = mapped.slice(i, i + batchSize);
        const { error } = await (supabase as any)
          .from("pennyekart_orders")
          .upsert(batch, { onConflict: "id" });
        if (error) throw error;
        totalUpserted += batch.length;
      }

      toast.success(`Uploaded ${totalUpserted} orders successfully`);
      await loadOrders();
    } catch (err: any) {
      toast.error("Upload failed: " + (err.message || "Unknown error"));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [loadOrders]);

  useEffect(() => {
    loadOrders();
  }, []);

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
    const collected = filteredOrders.reduce((s, o) => s + (o.collected_amount || 0), 0);
    const purchaseCost = filteredOrders.reduce((s, o) => s + (o.cost_amount || 0), 0);
    const grossProfit = filteredOrders.reduce((s, o) => s + (o.profit_amount || 0), 0);
    const netProfit = filteredOrders.reduce((s, o) => s + (o.net_profit || 0), 0);
    return { totalOrders, salesAmount, collected, purchaseCost, grossProfit, netProfit };
  }, [filteredOrders]);

  const resetFilters = () => {
    setFromDate(""); setToDate(""); setStatusFilter("delivered");
    setGodownFilter("all"); setDistrictFilter("all");
    setPanchayathFilter("all"); setWardFilter("all");
  };

  // Export to Excel
  const exportExcel = () => {
    const rows = filteredOrders.map((o, i) => ({
      "#": i + 1,
      "Order ID": o.id,
      "Date": o.source_created_at ? new Date(o.source_created_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" }) : "",
      "Customer": o.customer_name || "",
      "Items": o.items || "",
      "Sales ₹": o.total_amount || 0,
      "Collected ₹": o.collected_amount || 0,
      "Cost ₹": o.cost_amount || 0,
      "Gross Profit ₹": o.profit_amount || 0,
      "Net Profit ₹": o.net_profit || 0,
      "Status": o.status || "",
      "Godown": o.godown || "",
      "Godown Type": o.godown_type || "",
      "Panchayath": o.panchayath_name || "",
      "District": o.district || "",
      "Ward": o.ward || "",
      "Self": o.self_pickup || "",
      "Delivery": o.delivery || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = Object.keys(rows[0] || {}).map(() => ({ wch: 16 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sales Report");
    XLSX.writeFile(wb, `Sales_Report_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  // Export to PDF (print)
  const exportPdf = () => {
    const fmt = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
    const html = `<!DOCTYPE html><html><head><title>Sales Report</title>
<style>
body{font-family:Arial,sans-serif;margin:20px;font-size:11px;color:#333}
h1{font-size:18px;margin-bottom:4px}
.meta{color:#666;margin-bottom:12px;font-size:10px}
.stats{display:flex;gap:16px;margin-bottom:16px;flex-wrap:wrap}
.stat{border:1px solid #e5e7eb;border-radius:8px;padding:8px 14px;min-width:120px}
.stat-label{font-size:10px;color:#888}.stat-value{font-size:16px;font-weight:bold}
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
<div class="stat"><div class="stat-label">Sales Amount</div><div class="stat-value">${fmt(stats.salesAmount)}</div></div>
<div class="stat"><div class="stat-label">Collected</div><div class="stat-value">${fmt(stats.collected)}</div></div>
<div class="stat"><div class="stat-label">Purchase Cost</div><div class="stat-value">${fmt(stats.purchaseCost)}</div></div>
<div class="stat"><div class="stat-label">Gross Profit</div><div class="stat-value">${fmt(stats.grossProfit)}</div></div>
<div class="stat"><div class="stat-label">Net Profit</div><div class="stat-value">${fmt(stats.netProfit)}</div></div>
</div>
<table><thead><tr><th>#</th><th>Order ID</th><th>Date</th><th>Customer</th><th>Items</th><th>Sales ₹</th><th>Collected ₹</th><th>Cost ₹</th><th>Gross Profit</th><th>Net Profit</th><th>Status</th><th>Godown</th><th>Panchayath</th><th>Ward</th></tr></thead><tbody>
${filteredOrders.map((o, i) => `<tr><td>${i + 1}</td><td>${o.id}</td><td>${o.source_created_at ? new Date(o.source_created_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" }) : ""}</td><td>${o.customer_name || ""}</td><td>${o.items || ""}</td><td>₹${(o.total_amount || 0).toFixed(2)}</td><td>₹${(o.collected_amount || 0).toFixed(2)}</td><td>₹${(o.cost_amount || 0).toFixed(2)}</td><td class="${(o.profit_amount || 0) >= 0 ? "profit" : "loss"}">₹${(o.profit_amount || 0).toFixed(2)}</td><td class="${(o.net_profit || 0) >= 0 ? "profit" : "loss"}">₹${(o.net_profit || 0).toFixed(2)}</td><td>${o.status || ""}</td><td>${o.godown || ""}</td><td>${o.panchayath_name || ""}</td><td>${o.ward || ""}</td></tr>`).join("")}
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
              {lastUploaded && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-green-500" /> Last uploaded: {lastUploaded}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleUpload}
            />
            <Button
              variant="default"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
              {uploading ? "Uploading..." : "Upload Excel"}
            </Button>
            <Button variant="outline" size="sm" onClick={exportExcel} disabled={filteredOrders.length === 0}>
              <FileSpreadsheet className="h-4 w-4 mr-1" /> Export Excel
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
                <RotateCcw className="h-3 w-3 mr-1" /> Reset
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
              <StatCard icon={Wallet} label="Collected" value={`₹${stats.collected.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`} color="text-amber-600" />
              <StatCard icon={DollarSign} label="Purchase Cost" value={`₹${stats.purchaseCost.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`} color="text-foreground" />
              <StatCard icon={TrendingUp} label="Gross Profit" value={`₹${stats.grossProfit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`} color="text-green-600" />
              <StatCard icon={TrendingDown} label="Net Profit" value={`₹${stats.netProfit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`} color="text-green-600" />
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
                        <TableHead className="text-right">Gross Profit</TableHead>
                        <TableHead className="text-right">Net Profit</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Godown</TableHead>
                        <TableHead>Godown Type</TableHead>
                        <TableHead>Panchayath</TableHead>
                        <TableHead>District</TableHead>
                        <TableHead>Ward</TableHead>
                        <TableHead>Self</TableHead>
                        <TableHead>Delivery</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOrders.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={17} className="text-center text-muted-foreground py-12">
                            {orders.length === 0 ? "No orders yet. Upload an Excel file from Pennyekart to get started." : "No orders found matching filters"}
                          </TableCell>
                        </TableRow>
                      ) : filteredOrders.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-mono text-xs">{order.id.length > 10 ? order.id.substring(0, 8) + "..." : order.id}</TableCell>
                          <TableCell className="text-xs whitespace-nowrap">
                            {order.source_created_at
                              ? new Date(order.source_created_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })
                              : "—"}
                          </TableCell>
                          <TableCell>{order.customer_name || "—"}</TableCell>
                          <TableCell className="text-xs">{typeof order.items === "string" ? order.items : "—"}</TableCell>
                          <TableCell className="text-right">₹{(order.total_amount || 0).toFixed(2)}</TableCell>
                          <TableCell className="text-right">₹{(order.collected_amount || 0).toFixed(2)}</TableCell>
                          <TableCell className="text-right">₹{(order.cost_amount || 0).toFixed(2)}</TableCell>
                          <TableCell className={`text-right font-medium ${(order.profit_amount || 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
                            ₹{(order.profit_amount || 0).toFixed(2)}
                          </TableCell>
                          <TableCell className={`text-right font-medium ${(order.net_profit || 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
                            ₹{(order.net_profit || 0).toFixed(2)}
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
                          <TableCell className="text-xs">{order.godown_type || "—"}</TableCell>
                          <TableCell className="text-xs">{order.panchayath_name || "—"}</TableCell>
                          <TableCell className="text-xs">{order.district || "—"}</TableCell>
                          <TableCell>{order.ward || "—"}</TableCell>
                          <TableCell className="text-xs">{order.self_pickup || "—"}</TableCell>
                          <TableCell className="text-xs">{order.delivery || "—"}</TableCell>
                        </TableRow>
                      ))}
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
