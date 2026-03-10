import { useState, useEffect, useCallback } from "react";
import { Layout } from "@/components/layout/Layout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Link, Navigate } from "react-router-dom";
import {
  ArrowLeft, Loader2, IndianRupee, Receipt, Clock, ShieldCheck,
  FileText, Send, Pencil, Trash2, Building2,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

interface Collection {
  id: string;
  person_name: string;
  mobile: string;
  amount: number;
  receipt_number: string;
  status: "pending" | "verified" | "submitted";
  notes: string | null;
  division_id: string;
  panchayath_name: string | null;
  collected_by_name: string | null;
  verified_by_name: string | null;
  verified_at: string | null;
  submitted_by_name: string | null;
  submitted_at: string | null;
  created_at: string;
  divisions?: { name: string };
}

interface Report {
  totalCollected: number;
  pendingAmount: number;
  verifiedAmount: number;
  submittedAmount: number;
  totalEntries: number;
  pendingCount: number;
  verifiedCount: number;
  submittedCount: number;
}

export default function SuperAdminCashCollections() {
  const { isSuperAdmin } = useAuth();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState("collections");
  const [collections, setCollections] = useState<Collection[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Edit state
  const [editDialog, setEditDialog] = useState(false);
  const [editItem, setEditItem] = useState<Collection | null>(null);
  const [editForm, setEditForm] = useState({ person_name: "", mobile: "", amount: "", notes: "", status: "", panchayath_name: "" });
  const [isSaving, setIsSaving] = useState(false);

  // Delete state
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deleteItem, setDeleteItem] = useState<Collection | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const invokeFunction = useCallback(
    async (params: Record<string, string>, method: "GET" | "POST" | "PUT" | "DELETE" = "GET", body?: any) => {
      const queryStr = new URLSearchParams(params).toString();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const { data, error } = await supabase.functions.invoke("admin-cash-collections?" + queryStr, {
        method,
        body: body ? JSON.stringify(body) : undefined,
        headers,
      });
      if (error) throw error;
      return data;
    },
    []
  );

  const loadCollections = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, string> = { action: "list_all" };
      if (filterStatus !== "all") params.status = filterStatus;
      const data = await invokeFunction(params);
      setCollections(data.collections || []);
    } catch {
      toast({ title: "Error", description: "Failed to load collections", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [invokeFunction, filterStatus, toast]);

  const loadReport = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await invokeFunction({ action: "report_all" });
      setReport(data.report || null);
      setCollections(data.collections || []);
    } catch {
      toast({ title: "Error", description: "Failed to load report", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [invokeFunction, toast]);

  useEffect(() => {
    if (activeTab === "collections") loadCollections();
    if (activeTab === "report") loadReport();
  }, [activeTab, loadCollections, loadReport]);

  if (!isSuperAdmin) return <Navigate to="/unauthorized" replace />;

  const openEdit = (c: Collection) => {
    setEditItem(c);
    setEditForm({
      person_name: c.person_name,
      mobile: c.mobile,
      amount: String(c.amount),
      notes: c.notes || "",
      status: c.status,
      panchayath_name: c.panchayath_name || "",
    });
    setEditDialog(true);
  };

  const handleSaveEdit = async () => {
    if (!editItem) return;
    setIsSaving(true);
    try {
      await invokeFunction({}, "PUT", {
        collection_id: editItem.id,
        action: "edit",
        person_name: editForm.person_name,
        mobile: editForm.mobile,
        amount: Number(editForm.amount),
        notes: editForm.notes || null,
        status: editForm.status,
        panchayath_name: editForm.panchayath_name || null,
      });
      toast({ title: "Updated", description: "Collection updated successfully" });
      setEditDialog(false);
      loadCollections();
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to update", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    setIsDeleting(true);
    try {
      await invokeFunction({ collection_id: deleteItem.id }, "DELETE");
      toast({ title: "Deleted", description: `Collection ${deleteItem.receipt_number} deleted` });
      setDeleteDialog(false);
      setDeleteItem(null);
      loadCollections();
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to delete", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />Pending</Badge>;
      case "verified":
        return <Badge className="gap-1 bg-green-600"><ShieldCheck className="h-3 w-3" />Verified</Badge>;
      case "submitted":
        return <Badge className="gap-1 bg-blue-600"><Send className="h-3 w-3" />Submitted</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Layout>
      <div className="container py-6 max-w-6xl">
        <div className="flex items-center gap-3 mb-6">
          <Button asChild variant="ghost" size="icon">
            <Link to="/super-admin"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <IndianRupee className="h-6 w-6 text-primary" />
              Cash Collections (All Divisions)
            </h1>
            <p className="text-sm text-muted-foreground">Manage all cash collections across divisions</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="collections"><FileText className="h-4 w-4 mr-1" />All Collections</TabsTrigger>
            <TabsTrigger value="report"><Receipt className="h-4 w-4 mr-1" />Report</TabsTrigger>
          </TabsList>

          <TabsContent value="collections">
            <Card>
              <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <CardTitle className="text-lg">All Collections</CardTitle>
                  <CardDescription>Collections from all divisions</CardDescription>
                </div>
                <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Filter status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="verified">Verified</SelectItem>
                    <SelectItem value="submitted">Submitted</SelectItem>
                  </SelectContent>
                </Select>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                ) : collections.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No collections found</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Receipt</TableHead>
                          <TableHead>Division</TableHead>
                          <TableHead>Person</TableHead>
                          <TableHead>Mobile</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {collections.map((c) => (
                          <TableRow key={c.id}>
                            <TableCell className="font-mono text-xs">{c.receipt_number}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                <Building2 className="h-3 w-3 mr-1" />
                                {c.divisions?.name || "—"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <p className="font-medium text-sm">{c.person_name}</p>
                              {c.panchayath_name && <p className="text-xs text-muted-foreground">{c.panchayath_name}</p>}
                            </TableCell>
                            <TableCell className="text-sm">{c.mobile}</TableCell>
                            <TableCell className="font-medium">₹{Number(c.amount).toLocaleString()}</TableCell>
                            <TableCell>{statusBadge(c.status)}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(c)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => { setDeleteItem(c); setDeleteDialog(true); }}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="report">
            <div className="space-y-4">
              {report && (
                <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                  <Card><CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-foreground">₹{report.totalCollected.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Total Collected</p>
                    <Badge variant="outline" className="mt-1">{report.totalEntries} entries</Badge>
                  </CardContent></Card>
                  <Card><CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-amber-600">₹{report.pendingAmount.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Pending</p>
                    <Badge variant="secondary" className="mt-1">{report.pendingCount}</Badge>
                  </CardContent></Card>
                  <Card><CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-green-600">₹{report.verifiedAmount.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Verified</p>
                    <Badge className="mt-1 bg-green-600">{report.verifiedCount}</Badge>
                  </CardContent></Card>
                  <Card><CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-blue-600">₹{report.submittedAmount.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Submitted</p>
                    <Badge className="mt-1 bg-blue-600">{report.submittedCount}</Badge>
                  </CardContent></Card>
                </div>
              )}

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Full Report</CardTitle>
                  <CardDescription>All collections across all divisions</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                  ) : collections.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No data</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Receipt</TableHead>
                            <TableHead>Division</TableHead>
                            <TableHead>Person</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Collected By</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {collections.map((c) => (
                            <TableRow key={c.id}>
                              <TableCell className="font-mono text-xs">{c.receipt_number}</TableCell>
                              <TableCell className="text-xs">{c.divisions?.name || "—"}</TableCell>
                              <TableCell>
                                <p className="font-medium text-sm">{c.person_name}</p>
                                <p className="text-xs text-muted-foreground">{c.mobile}</p>
                              </TableCell>
                              <TableCell className="font-medium">₹{Number(c.amount).toLocaleString()}</TableCell>
                              <TableCell>{statusBadge(c.status)}</TableCell>
                              <TableCell className="text-sm">{c.collected_by_name}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {format(new Date(c.created_at), "dd/MM/yy HH:mm")}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(c)}>
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => { setDeleteItem(c); setDeleteDialog(true); }}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
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
          </TabsContent>
        </Tabs>

        {/* Edit Dialog */}
        <Dialog open={editDialog} onOpenChange={setEditDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Collection</DialogTitle>
              <DialogDescription>Edit collection {editItem?.receipt_number}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Person Name</Label>
                <Input value={editForm.person_name} onChange={(e) => setEditForm({ ...editForm, person_name: e.target.value })} />
              </div>
              <div>
                <Label>Mobile</Label>
                <Input value={editForm.mobile} onChange={(e) => setEditForm({ ...editForm, mobile: e.target.value })} />
              </div>
              <div>
                <Label>Amount (₹)</Label>
                <Input type="number" value={editForm.amount} onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })} />
              </div>
              <div>
                <Label>Panchayath</Label>
                <Input value={editForm.panchayath_name} onChange={(e) => setEditForm({ ...editForm, panchayath_name: e.target.value })} />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="verified">Verified</SelectItem>
                    <SelectItem value="submitted">Submitted</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} rows={2} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialog(false)}>Cancel</Button>
              <Button onClick={handleSaveEdit} disabled={isSaving}>
                {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={deleteDialog} onOpenChange={setDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Collection</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete collection <strong>{deleteItem?.receipt_number}</strong> (₹{Number(deleteItem?.amount || 0).toLocaleString()} from {deleteItem?.person_name})? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {isDeleting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}
