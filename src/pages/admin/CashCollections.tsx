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
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Link, Navigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Search, Plus, Loader2, CheckCircle, Send, IndianRupee,
  Receipt, Clock, ShieldCheck, FileText, UserPlus, Building2,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

interface SearchResult {
  type: "member" | "registration";
  id: string;
  name: string;
  mobile: string;
  division_id: string | null;
  panchayath_id: string | null;
  panchayath_name: string | null;
  program_name?: string;
}

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

export default function CashCollections() {
  const { divisionId } = useParams<{ divisionId: string }>();
  const { isAdmin, isSuperAdmin, adminToken, adminData, isReadOnly } = useAuth();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState("collect");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<SearchResult | null>(null);
  const [showNewPersonForm, setShowNewPersonForm] = useState(false);
  const [newPerson, setNewPerson] = useState({ name: "", mobile: "", panchayath_name: "" });
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [collections, setCollections] = useState<Collection[]>([]);
  const [isLoadingCollections, setIsLoadingCollections] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<Collection | null>(null);

  const invokeFunction = useCallback(
    async (params: Record<string, string>, method: "GET" | "POST" | "PUT" | "DELETE" = "GET", body?: any) => {
      const queryStr = new URLSearchParams(params).toString();
      const { data, error } = await supabase.functions.invoke("admin-cash-collections?" + queryStr, {
        method,
        body: body ? JSON.stringify(body) : undefined,
        headers: {
          "x-admin-token": adminToken || "",
          "Content-Type": "application/json",
        },
      });
      if (error) throw error;
      return data;
    },
    [adminToken]
  );

  // Search mobile
  const handleSearch = useCallback(
    async (query: string) => {
      setSearchQuery(query);
      if (query.length < 3) {
        setSearchResults([]);
        return;
      }
      setIsSearching(true);
      try {
        const data = await invokeFunction({ action: "search_mobile", mobile: query });
        setSearchResults(data.results || []);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [invokeFunction]
  );

  // Load collections
  const loadCollections = useCallback(
    async (status?: string) => {
      setIsLoadingCollections(true);
      try {
        const params: Record<string, string> = { action: "list", division_id: divisionId || "" };
        if (status) params.status = status;
        const data = await invokeFunction(params);
        setCollections(data.collections || []);
      } catch {
        toast({ title: "Error", description: "Failed to load collections", variant: "destructive" });
      } finally {
        setIsLoadingCollections(false);
      }
    },
    [invokeFunction, divisionId, toast]
  );

  // Load report
  const loadReport = useCallback(async () => {
    try {
      const data = await invokeFunction({ action: "report", division_id: divisionId || "" });
      setReport(data.report || null);
      setCollections(data.collections || []);
    } catch {
      toast({ title: "Error", description: "Failed to load report", variant: "destructive" });
    }
  }, [invokeFunction, divisionId, toast]);

  useEffect(() => {
    if (activeTab === "collections" || activeTab === "verify") loadCollections();
    if (activeTab === "report") loadReport();
  }, [activeTab, loadCollections, loadReport]);

  // Access checks (after all hooks)
  if (!isAdmin && !isSuperAdmin) return <Navigate to="/unauthorized" replace />;

  const hasAccess =
    isSuperAdmin ||
    adminData?.access_all_divisions ||
    adminData?.division_id === divisionId ||
    (adminData?.additional_division_ids || []).includes(divisionId || "");

  if (!hasAccess) return <Navigate to="/unauthorized" replace />;


  const selectPerson = (person: SearchResult) => {
    setSelectedPerson(person);
    setShowNewPersonForm(false);
    setSearchResults([]);
    setSearchQuery(person.mobile);
  };

  // Create new person entry
  const selectNewPerson = () => {
    setShowNewPersonForm(true);
    setSelectedPerson(null);
    setNewPerson({ name: "", mobile: searchQuery, panchayath_name: "" });
  };

  // Submit collection
  const handleCollect = async () => {
    const personName = selectedPerson?.name || newPerson.name;
    const mobile = selectedPerson?.mobile || newPerson.mobile;

    if (!personName || !mobile || !amount) {
      toast({ title: "Error", description: "Name, mobile, and amount are required", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const data = await invokeFunction({}, "POST", {
        person_name: personName,
        mobile,
        division_id: selectedPerson?.division_id || divisionId,
        panchayath_id: selectedPerson?.panchayath_id,
        panchayath_name: selectedPerson?.panchayath_name || newPerson.panchayath_name,
        member_id: selectedPerson?.type === "member" ? selectedPerson.id : null,
        amount: Number(amount),
        notes,
      });

      if (data.success) {
        setLastReceipt(data.collection);
        setShowReceiptDialog(true);
        toast({ title: "Success", description: `Collection recorded. Receipt: ${data.collection.receipt_number}` });
        // Reset form
        setSelectedPerson(null);
        setShowNewPersonForm(false);
        setNewPerson({ name: "", mobile: "", panchayath_name: "" });
        setSearchQuery("");
        setAmount("");
        setNotes("");
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to record collection", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Verify collection
  const handleVerify = async (id: string) => {
    setIsProcessing(true);
    try {
      await invokeFunction({}, "PUT", { collection_id: id, action: "verify" });
      toast({ title: "Verified", description: "Collection verified successfully" });
      loadCollections();
    } catch {
      toast({ title: "Error", description: "Failed to verify", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  // Submit to office
  const handleSubmitToOffice = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      toast({ title: "Error", description: "Select verified collections to submit", variant: "destructive" });
      return;
    }
    setIsProcessing(true);
    try {
      await invokeFunction({}, "PUT", { collection_ids: ids, action: "submit" });
      toast({ title: "Submitted", description: `${ids.length} collection(s) submitted to office with receipts` });
      setSelectedIds(new Set());
      loadCollections();
      loadReport();
    } catch {
      toast({ title: "Error", description: "Failed to submit", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleSelection = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
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
      <div className="container py-6 max-w-5xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button asChild variant="ghost" size="icon">
            <Link to={`/admin/division/${divisionId}`}>
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <IndianRupee className="h-6 w-6 text-primary" />
              Cash Collection
            </h1>
            <p className="text-sm text-muted-foreground">Manage accounts and cash collections</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="collect" className="text-xs sm:text-sm">
              <Plus className="h-4 w-4 mr-1" />Collect
            </TabsTrigger>
            <TabsTrigger value="collections" className="text-xs sm:text-sm">
              <FileText className="h-4 w-4 mr-1" />All
            </TabsTrigger>
            <TabsTrigger value="verify" className="text-xs sm:text-sm">
              <ShieldCheck className="h-4 w-4 mr-1" />Verify
            </TabsTrigger>
            <TabsTrigger value="report" className="text-xs sm:text-sm">
              <Receipt className="h-4 w-4 mr-1" />Report
            </TabsTrigger>
          </TabsList>

          {/* COLLECT TAB */}
          <TabsContent value="collect">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">New Collection</CardTitle>
                <CardDescription>Search by mobile number to find a person or create new</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Mobile Search */}
                <div>
                  <Label>Mobile Number</Label>
                  <div className="relative mt-1">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Type mobile number to search..."
                      value={searchQuery}
                      onChange={(e) => handleSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>

                  {/* Search Results */}
                  {isSearching && (
                    <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />Searching...
                    </div>
                  )}

                  {searchResults.length > 0 && (
                    <div className="mt-2 border rounded-lg max-h-48 overflow-y-auto">
                      {searchResults.map((r, i) => (
                        <button
                          key={`${r.type}-${r.id}-${i}`}
                          onClick={() => selectPerson(r)}
                          className="w-full text-left px-3 py-2 hover:bg-accent/50 border-b last:border-b-0 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-sm">{r.name}</p>
                              <p className="text-xs text-muted-foreground">{r.mobile}</p>
                            </div>
                            <div className="text-right">
                              <Badge variant="outline" className="text-[10px]">
                                {r.type === "member" ? "Member" : "Registration"}
                              </Badge>
                              {r.panchayath_name && (
                                <p className="text-[10px] text-muted-foreground mt-0.5">{r.panchayath_name}</p>
                              )}
                              {r.program_name && (
                                <p className="text-[10px] text-muted-foreground">{r.program_name}</p>
                              )}
                            </div>
                          </div>
                        </button>
                      ))}
                      <button
                        onClick={selectNewPerson}
                        className="w-full text-left px-3 py-2 hover:bg-accent/50 transition-colors flex items-center gap-2 text-primary"
                      >
                        <UserPlus className="h-4 w-4" />
                        <span className="text-sm font-medium">Create new person</span>
                      </button>
                    </div>
                  )}

                  {searchQuery.length >= 3 && !isSearching && searchResults.length === 0 && (
                    <div className="mt-2 border rounded-lg p-3">
                      <p className="text-sm text-muted-foreground mb-2">No results found</p>
                      <Button variant="outline" size="sm" onClick={selectNewPerson}>
                        <UserPlus className="h-4 w-4 mr-1" />Create new person
                      </Button>
                    </div>
                  )}
                </div>

                {/* Selected Person Display */}
                {selectedPerson && (
                  <Card className="bg-accent/30">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{selectedPerson.name}</p>
                          <p className="text-sm text-muted-foreground">{selectedPerson.mobile}</p>
                          {selectedPerson.panchayath_name && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Building2 className="h-3 w-3" />{selectedPerson.panchayath_name}
                            </p>
                          )}
                        </div>
                        <Badge variant="outline">{selectedPerson.type}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* New Person Form */}
                {showNewPersonForm && (
                  <div className="space-y-3 p-3 border rounded-lg bg-accent/20">
                    <p className="text-sm font-medium">New Person Details</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label className="text-xs">Full Name *</Label>
                        <Input
                          value={newPerson.name}
                          onChange={(e) => setNewPerson({ ...newPerson, name: e.target.value })}
                          placeholder="Enter full name"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Mobile *</Label>
                        <Input
                          value={newPerson.mobile}
                          onChange={(e) => setNewPerson({ ...newPerson, mobile: e.target.value })}
                          placeholder="Enter mobile"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <Label className="text-xs">Panchayath</Label>
                        <Input
                          value={newPerson.panchayath_name}
                          onChange={(e) => setNewPerson({ ...newPerson, panchayath_name: e.target.value })}
                          placeholder="Enter panchayath name"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Amount & Notes */}
                {(selectedPerson || showNewPersonForm) && (
                  <div className="space-y-3">
                    <div>
                      <Label>Amount (₹) *</Label>
                      <Input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="Enter amount"
                        min="0"
                        step="0.01"
                      />
                    </div>
                    <div>
                      <Label>Notes (optional)</Label>
                      <Textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Any additional notes..."
                        rows={2}
                      />
                    </div>
                    <Button
                      onClick={handleCollect}
                      disabled={isSubmitting || isReadOnly}
                      className="w-full"
                    >
                      {isSubmitting ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <IndianRupee className="h-4 w-4 mr-2" />
                      )}
                      Record Collection
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ALL COLLECTIONS TAB */}
          <TabsContent value="collections">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">All Collections</CardTitle>
                <CardDescription>View all cash collections for this division</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingCollections ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : collections.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No collections yet</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Receipt</TableHead>
                          <TableHead>Person</TableHead>
                          <TableHead>Mobile</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {collections.map((c) => (
                          <TableRow key={c.id}>
                            <TableCell className="font-mono text-xs">{c.receipt_number}</TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium text-sm">{c.person_name}</p>
                                {c.panchayath_name && (
                                  <p className="text-xs text-muted-foreground">{c.panchayath_name}</p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">{c.mobile}</TableCell>
                            <TableCell className="font-medium">₹{Number(c.amount).toLocaleString()}</TableCell>
                            <TableCell>{statusBadge(c.status)}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
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

          {/* VERIFY & SUBMIT TAB */}
          <TabsContent value="verify">
            <div className="space-y-4">
              {/* Batch submit button */}
              {selectedIds.size > 0 && (
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="p-3 flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {selectedIds.size} verified collection(s) selected
                    </span>
                    <Button size="sm" onClick={handleSubmitToOffice} disabled={isProcessing}>
                      {isProcessing ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <Send className="h-4 w-4 mr-1" />
                      )}
                      Submit to Office
                    </Button>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Verification & Submission</CardTitle>
                  <CardDescription>Verify pending collections and submit verified ones to office</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingCollections ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : collections.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No collections to process</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10"></TableHead>
                            <TableHead>Receipt</TableHead>
                            <TableHead>Person</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Collected By</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {collections.map((c) => (
                            <TableRow key={c.id}>
                              <TableCell>
                                {c.status === "verified" && (
                                  <Checkbox
                                    checked={selectedIds.has(c.id)}
                                    onCheckedChange={() => toggleSelection(c.id)}
                                  />
                                )}
                              </TableCell>
                              <TableCell className="font-mono text-xs">{c.receipt_number}</TableCell>
                              <TableCell>
                                <p className="font-medium text-sm">{c.person_name}</p>
                                <p className="text-xs text-muted-foreground">{c.mobile}</p>
                              </TableCell>
                              <TableCell className="font-medium">₹{Number(c.amount).toLocaleString()}</TableCell>
                              <TableCell>
                                {statusBadge(c.status)}
                                {c.verified_by_name && (
                                  <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-0.5">
                                    <ShieldCheck className="h-3 w-3 text-green-600" />
                                    {c.verified_by_name}
                                  </p>
                                )}
                                {c.submitted_by_name && (
                                  <p className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                    <Send className="h-3 w-3 text-blue-600" />
                                    {c.submitted_by_name}
                                  </p>
                                )}
                              </TableCell>
                              <TableCell className="text-sm">{c.collected_by_name}</TableCell>
                              <TableCell>
                                {c.status === "pending" && !isReadOnly && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleVerify(c.id)}
                                    disabled={isProcessing}
                                  >
                                    <CheckCircle className="h-4 w-4 mr-1" />Verify
                                  </Button>
                                )}
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

          {/* REPORT TAB */}
          <TabsContent value="report">
            <div className="space-y-4">
              {report && (
                <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold text-foreground">₹{report.totalCollected.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Total Collected</p>
                      <Badge variant="outline" className="mt-1">{report.totalEntries} entries</Badge>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold text-amber-600">₹{report.pendingAmount.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Pending</p>
                      <Badge variant="secondary" className="mt-1">{report.pendingCount}</Badge>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold text-green-600">₹{report.verifiedAmount.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Verified</p>
                      <Badge className="mt-1 bg-green-600">{report.verifiedCount}</Badge>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold text-blue-600">₹{report.submittedAmount.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Submitted</p>
                      <Badge className="mt-1 bg-blue-600">{report.submittedCount}</Badge>
                    </CardContent>
                  </Card>
                </div>
              )}

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Collection Report</CardTitle>
                  <CardDescription>Full collection history with details</CardDescription>
                </CardHeader>
                <CardContent>
                  {collections.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No data</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Receipt</TableHead>
                            <TableHead>Person</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Verified By</TableHead>
                            <TableHead>Submitted</TableHead>
                            <TableHead>Date</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {collections.map((c) => (
                            <TableRow key={c.id}>
                              <TableCell className="font-mono text-xs">{c.receipt_number}</TableCell>
                              <TableCell>
                                <p className="font-medium text-sm">{c.person_name}</p>
                                <p className="text-xs text-muted-foreground">{c.mobile}</p>
                              </TableCell>
                              <TableCell className="font-medium">₹{Number(c.amount).toLocaleString()}</TableCell>
                              <TableCell>{statusBadge(c.status)}</TableCell>
                              <TableCell>
                                {c.verified_by_name ? (
                                  <div className="flex items-center gap-1 text-xs">
                                    <ShieldCheck className="h-3 w-3 text-green-600" />
                                    {c.verified_by_name}
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {c.submitted_at ? (
                                  <div className="text-xs">
                                    <p>{c.submitted_by_name}</p>
                                    <p className="text-muted-foreground">
                                      {format(new Date(c.submitted_at), "dd/MM/yy")}
                                    </p>
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {format(new Date(c.created_at), "dd/MM/yy HH:mm")}
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

        {/* Receipt Dialog */}
        <Dialog open={showReceiptDialog} onOpenChange={setShowReceiptDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-primary" />
                Collection Recorded
              </DialogTitle>
              <DialogDescription>Receipt generated successfully</DialogDescription>
            </DialogHeader>
            {lastReceipt && (
              <div className="space-y-3 p-4 bg-accent/20 rounded-lg">
                <div className="text-center">
                  <p className="text-2xl font-bold font-mono">{lastReceipt.receipt_number}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Name</p>
                    <p className="font-medium">{lastReceipt.person_name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Mobile</p>
                    <p className="font-medium">{lastReceipt.mobile}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Amount</p>
                    <p className="font-bold text-lg">₹{Number(lastReceipt.amount).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Status</p>
                    {statusBadge(lastReceipt.status)}
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button onClick={() => setShowReceiptDialog(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
