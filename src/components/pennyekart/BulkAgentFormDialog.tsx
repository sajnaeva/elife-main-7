import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
// ScrollArea removed - using native overflow-y-auto for better flex container compatibility
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, Plus, Trash2, UserPlus, Users, MapPin, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { 
  PennyekartAgent, 
  AgentRole, 
  ROLE_LABELS, 
  ROLE_HIERARCHY,
  getParentRole,
  useAgentMutations,
} from "@/hooks/usePennyekartAgents";
import { toast } from "sonner";

// Single agent schema with responsibility fields
const singleAgentSchema = z.object({
  // Personal details
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  mobile: z.string().regex(/^[0-9]{10}$/, "Mobile must be 10 digits"),
  role: z.enum(["scode", "team_leader", "coordinator", "group_leader", "pro"] as const),
  panchayath_id: z.string().min(1, "Select a panchayath"),
  ward: z.string().default(""),
  parent_agent_id: z.string().uuid().nullable().optional(),
  customer_count: z.number().int().min(0).default(0),
  // Responsibility scope
  responsible_panchayath_ids: z.array(z.string().uuid()).default([]),
  responsible_wards: z.array(z.string()).default([]),
}).superRefine((data, ctx) => {
  // Ward is required for non-top-level roles
  if (data.role !== "team_leader" && data.role !== "scode" && (!data.ward || data.ward.trim() === "")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Ward is required",
      path: ["ward"],
    });
  }
  // Parent agent is required for non-top-level roles
  if (data.role !== "team_leader" && data.role !== "scode" && !data.parent_agent_id) {
    const parentRoleLabel = data.role === "pro" ? "Group Leader" : data.role === "group_leader" ? "Coordinator" : "Team Leader";
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Please select a ${parentRoleLabel}`,
      path: ["parent_agent_id"],
    });
  }
  // Team leaders must have at least one responsible panchayath
  if (data.role === "team_leader" && (!data.responsible_panchayath_ids || data.responsible_panchayath_ids.length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Select at least one responsible panchayath",
      path: ["responsible_panchayath_ids"],
    });
  }
});

const bulkAgentSchema = z.object({
  panchayath_id: z.string().uuid("Select a panchayath"),
  role: z.enum(["scode", "team_leader", "coordinator", "group_leader", "pro"] as const),
  parent_agent_id: z.string().uuid().nullable().optional(),
  // For coordinators, all bulk agents share responsibility wards
  responsible_wards: z.array(z.string()).default([]),
  agents: z.array(z.object({
    name: z.string().min(2, "Name required"),
    mobile: z.string().regex(/^[0-9]{10}$/, "10 digits required"),
    ward: z.string().min(1, "Ward required"),
    customer_count: z.number().int().min(0).default(0),
  })).min(1, "Add at least one agent"),
}).superRefine((data, ctx) => {
  if (data.role !== "team_leader" && data.role !== "scode" && !data.parent_agent_id) {
    const parentRoleLabel = data.role === "pro" ? "Group Leader" : data.role === "group_leader" ? "Coordinator" : "Team Leader";
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Please select a ${parentRoleLabel}`,
      path: ["parent_agent_id"],
    });
  }
});

type SingleAgentFormValues = z.infer<typeof singleAgentSchema>;
type BulkAgentFormValues = z.infer<typeof bulkAgentSchema>;

interface BulkAgentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent?: PennyekartAgent | null;
  defaultParentId?: string | null;
  defaultRole?: AgentRole | null;
  onSuccess: () => void;
}

interface Panchayath {
  id: string;
  name: string;
  ward: string | null;
}

export function BulkAgentFormDialog({ 
  open, 
  onOpenChange, 
  agent, 
  defaultParentId,
  defaultRole,
  onSuccess 
}: BulkAgentFormDialogProps) {
  const [activeTab, setActiveTab] = useState<"single" | "bulk">("single");
  const [panchayaths, setPanchayaths] = useState<Panchayath[]>([]);
  const [wardOptions, setWardOptions] = useState<string[]>([]);
  const [potentialParents, setPotentialParents] = useState<PennyekartAgent[]>([]);
  const [isLoadingPanchayaths, setIsLoadingPanchayaths] = useState(false);

  const { createAgent, createBulkAgents, updateAgent, isSubmitting } = useAgentMutations();
  const isEditing = !!agent;

  // Single agent form
  const singleForm = useForm<SingleAgentFormValues>({
    resolver: zodResolver(singleAgentSchema),
    defaultValues: {
      name: "",
      mobile: "",
      role: defaultRole || "pro",
      panchayath_id: "",
      ward: "",
      parent_agent_id: defaultParentId || null,
      customer_count: 0,
      responsible_panchayath_ids: [],
      responsible_wards: [],
    },
  });

  // Bulk agent form
  const bulkForm = useForm<BulkAgentFormValues>({
    resolver: zodResolver(bulkAgentSchema),
    defaultValues: {
      panchayath_id: "",
      role: defaultRole || "pro",
      parent_agent_id: defaultParentId || null,
      responsible_wards: [],
      agents: [{ name: "", mobile: "", ward: "", customer_count: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: bulkForm.control,
    name: "agents",
  });

  const selectedSingleRole = singleForm.watch("role");
  const selectedSinglePanchayath = singleForm.watch("panchayath_id");
  const selectedResponsiblePanchayaths = singleForm.watch("responsible_panchayath_ids");
  const selectedBulkRole = bulkForm.watch("role");
  const selectedBulkPanchayath = bulkForm.watch("panchayath_id");

  // Load panchayaths
  useEffect(() => {
    const fetchPanchayaths = async () => {
      setIsLoadingPanchayaths(true);
      const { data } = await supabase
        .from("panchayaths")
        .select("id, name, ward")
        .eq("is_active", true)
        .order("name");
      
      setPanchayaths(data || []);
      setIsLoadingPanchayaths(false);
    };

    if (open) {
      fetchPanchayaths();
    }
  }, [open]);

  // Update ward options when panchayath changes (for single form)
  // Also re-run when agent changes to ensure options are loaded for editing
  useEffect(() => {
    const panchayathId = selectedSinglePanchayath || agent?.panchayath_id;
    if (panchayathId && panchayaths.length > 0) {
      const panchayath = panchayaths.find(p => p.id === panchayathId);
      if (panchayath?.ward) {
        const wardCount = parseInt(panchayath.ward, 10);
        if (!isNaN(wardCount) && wardCount > 0) {
          const wards = Array.from({ length: wardCount }, (_, i) => String(i + 1));
          setWardOptions(wards);
          return;
        }
      }
    }
    // Only clear if we have panchayaths loaded but none selected
    if (panchayaths.length > 0 && !panchayathId) {
      setWardOptions([]);
    }
  }, [selectedSinglePanchayath, panchayaths, agent]);

  // Update ward options when panchayath changes (for bulk form)
  useEffect(() => {
    if (selectedBulkPanchayath) {
      const panchayath = panchayaths.find(p => p.id === selectedBulkPanchayath);
      if (panchayath?.ward) {
        const wardCount = parseInt(panchayath.ward, 10);
        if (!isNaN(wardCount) && wardCount > 0) {
          const wards = Array.from({ length: wardCount }, (_, i) => String(i + 1));
          setWardOptions(wards);
          return;
        }
      }
    }
    setWardOptions([]);
  }, [selectedBulkPanchayath, panchayaths]);

  // Load potential parent agents (single form) - Team Leaders across all responsible panchayaths
  useEffect(() => {
    const fetchParentAgents = async () => {
      const parentRole = getParentRole(selectedSingleRole);
      if (!parentRole) {
        setPotentialParents([]);
        return;
      }

      // For coordinators and below, get parents from the selected panchayath
      // For team leaders, they have no parent
      let panchayathFilter = selectedSinglePanchayath;
      
      if (!panchayathFilter) {
        setPotentialParents([]);
        return;
      }

      const { data } = await supabase
        .from("pennyekart_agents")
        .select("id, name, role, ward, responsible_panchayath_ids")
        .or(`panchayath_id.eq.${panchayathFilter},responsible_panchayath_ids.cs.{${panchayathFilter}}`)
        .eq("role", parentRole)
        .eq("is_active", true)
        .order("name");

      setPotentialParents((data as unknown as PennyekartAgent[]) || []);
    };

    fetchParentAgents();
  }, [selectedSingleRole, selectedSinglePanchayath]);

  // Load potential parent agents (bulk form)
  useEffect(() => {
    const fetchParentAgents = async () => {
      const parentRole = getParentRole(selectedBulkRole);
      if (!parentRole || !selectedBulkPanchayath) {
        setPotentialParents([]);
        return;
      }

      const { data } = await supabase
        .from("pennyekart_agents")
        .select("id, name, role, ward, responsible_panchayath_ids")
        .or(`panchayath_id.eq.${selectedBulkPanchayath},responsible_panchayath_ids.cs.{${selectedBulkPanchayath}}`)
        .eq("role", parentRole)
        .eq("is_active", true)
        .order("name");

      setPotentialParents((data as unknown as PennyekartAgent[]) || []);
    };

    fetchParentAgents();
  }, [selectedBulkRole, selectedBulkPanchayath]);

  // Reset forms when dialog opens/closes
  useEffect(() => {
    if (open && agent) {
      setActiveTab("single");
      singleForm.reset({
        name: agent.name,
        mobile: agent.mobile,
        role: agent.role,
        panchayath_id: agent.panchayath_id,
        ward: agent.ward,
        parent_agent_id: agent.parent_agent_id,
        customer_count: agent.customer_count,
        responsible_panchayath_ids: agent.responsible_panchayath_ids || [],
        responsible_wards: agent.responsible_wards || [],
      });
    } else if (open) {
      singleForm.reset({
        name: "",
        mobile: "",
        role: defaultRole || "pro",
        panchayath_id: "",
        ward: "",
        parent_agent_id: defaultParentId || null,
        customer_count: 0,
        responsible_panchayath_ids: [],
        responsible_wards: [],
      });
      bulkForm.reset({
        panchayath_id: "",
        role: defaultRole || "pro",
        parent_agent_id: defaultParentId || null,
        responsible_wards: [],
        agents: [{ name: "", mobile: "", ward: "", customer_count: 0 }],
      });
    }
  }, [open, agent, defaultParentId, defaultRole, singleForm, bulkForm]);

  const onSubmitSingle = async (values: SingleAgentFormValues) => {
    try {
      // Top-level roles don't have parents
      if (values.role === "team_leader" || values.role === "scode") {
        values.parent_agent_id = null;
        // Set ward to "N/A" for top-level roles
        if (!values.ward) {
          values.ward = "N/A";
        }
      }

      // Only PROs can have customer count
      if (values.role !== "pro") {
        values.customer_count = 0;
      }

      // Set responsibility based on role
      let responsiblePanchayathIds: string[] = [];
      let responsibleWards: string[] = [];

      if (values.role === "team_leader") {
        responsiblePanchayathIds = values.responsible_panchayath_ids || [];
      } else if (values.role === "coordinator") {
        responsibleWards = values.responsible_wards || [];
      }

      const agentData = {
        name: values.name,
        mobile: values.mobile,
        role: values.role,
        panchayath_id: values.panchayath_id,
        ward: values.ward || "N/A",
        parent_agent_id: values.parent_agent_id || null,
        customer_count: values.customer_count,
        responsible_panchayath_ids: responsiblePanchayathIds,
        responsible_wards: responsibleWards,
        is_active: true,
      };

      if (isEditing && agent) {
        const { error } = await updateAgent(agent.id, agentData);
        if (error) {
          toast.error(error);
          return;
        }
        toast.success("Agent updated successfully");
      } else {
        const { error } = await createAgent(agentData);
        if (error) {
          toast.error(error);
          return;
        }
        toast.success("Agent created successfully");
      }

      onOpenChange(false);
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save agent");
    }
  };

  const onSubmitBulk = async (values: BulkAgentFormValues) => {
    try {
      const isPro = values.role === "pro";
      const isTopLevel = values.role === "team_leader" || values.role === "scode";
      const isCoordinator = values.role === "coordinator";

      const agentsToInsert = values.agents.map(a => ({
        name: a.name,
        mobile: a.mobile,
        role: values.role,
        panchayath_id: values.panchayath_id,
        ward: a.ward,
        parent_agent_id: isTopLevel ? null : (values.parent_agent_id || null),
        customer_count: isPro ? a.customer_count : 0,
        responsible_panchayath_ids: [] as string[],
        responsible_wards: isCoordinator ? values.responsible_wards : [] as string[],
        is_active: true,
      }));

      const { error, count } = await createBulkAgents(agentsToInsert);
      if (error) {
        toast.error(error);
        return;
      }

      toast.success(`${count} agents created successfully`);
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create agents");
    }
  };

  const singleParentRole = getParentRole(selectedSingleRole);
  const bulkParentRole = getParentRole(selectedBulkRole);
  const singleNeedsParent = selectedSingleRole !== "team_leader" && selectedSingleRole !== "scode";
  const bulkNeedsParent = selectedBulkRole !== "team_leader" && selectedBulkRole !== "scode";

  // Get ward options for all responsible panchayaths (for Team Leader viewing coordinator wards)
  const getWardsForPanchayath = (panchayathId: string) => {
    const panchayath = panchayaths.find(p => p.id === panchayathId);
    if (panchayath?.ward) {
      const wardCount = parseInt(panchayath.ward, 10);
      if (!isNaN(wardCount) && wardCount > 0) {
        return Array.from({ length: wardCount }, (_, i) => String(i + 1));
      }
    }
    return [];
  };

  // Multi-select toggle handler for panchayaths
  const togglePanchayathSelection = (panchayathId: string) => {
    const current = singleForm.getValues("responsible_panchayath_ids") || [];
    const updated = current.includes(panchayathId)
      ? current.filter(id => id !== panchayathId)
      : [...current, panchayathId];
    singleForm.setValue("responsible_panchayath_ids", updated);
  };

  // Multi-select toggle handler for wards
  const toggleWardSelection = (ward: string, formType: "single" | "bulk") => {
    if (formType === "single") {
      const current = singleForm.getValues("responsible_wards") || [];
      const updated = current.includes(ward)
        ? current.filter(w => w !== ward)
        : [...current, ward];
      singleForm.setValue("responsible_wards", updated);
    } else {
      const current = bulkForm.getValues("responsible_wards") || [];
      const updated = current.includes(ward)
        ? current.filter(w => w !== ward)
        : [...current, ward];
      bulkForm.setValue("responsible_wards", updated);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-[650px] h-[90vh] sm:h-auto sm:max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-2 sm:px-6 sm:pt-6 flex-shrink-0">
          <DialogTitle>{isEditing ? "Edit Agent" : "Add Agents"}</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            {isEditing ? "Update agent details" : "Add agents to the network"}
          </DialogDescription>
        </DialogHeader>

        {isEditing ? (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto px-4 sm:px-6" style={{ minHeight: 0 }}>
              <Form {...singleForm}>
                <form onSubmit={singleForm.handleSubmit(onSubmitSingle)} className="space-y-3 pb-4">
                  <SingleFormContent
                    form={singleForm}
                    panchayaths={panchayaths}
                    wardOptions={wardOptions}
                    potentialParents={potentialParents}
                    isLoadingPanchayaths={isLoadingPanchayaths}
                    needsParent={singleNeedsParent}
                    parentRole={singleParentRole}
                    selectedPanchayath={selectedSinglePanchayath}
                    selectedRole={selectedSingleRole}
                    selectedResponsiblePanchayaths={selectedResponsiblePanchayaths}
                    togglePanchayathSelection={togglePanchayathSelection}
                    toggleWardSelection={(ward) => toggleWardSelection(ward, "single")}
                    getWardsForPanchayath={getWardsForPanchayath}
                  />
                </form>
              </Form>
            </div>
            <div className="flex justify-end gap-2 px-4 py-3 sm:px-6 sm:py-4 border-t bg-background flex-shrink-0">
              <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button size="sm" disabled={isSubmitting} onClick={singleForm.handleSubmit(onSubmitSingle)}>
                {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Update
              </Button>
            </div>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "single" | "bulk")} className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <TabsList className="grid w-full grid-cols-2 mx-4 sm:mx-6 mt-2 flex-shrink-0" style={{ width: 'calc(100% - 2rem)' }}>
              <TabsTrigger value="single" className="flex items-center gap-1.5 text-xs sm:text-sm">
                <UserPlus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                Single
              </TabsTrigger>
              <TabsTrigger value="bulk" className="flex items-center gap-1.5 text-xs sm:text-sm">
                <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                Bulk
              </TabsTrigger>
            </TabsList>

            <TabsContent value="single" className="flex-1 min-h-0 flex flex-col mt-0 data-[state=inactive]:hidden overflow-hidden">
              <div className="flex-1 overflow-y-auto px-4 sm:px-6 pt-3" style={{ minHeight: 0 }}>
                <Form {...singleForm}>
                  <form className="space-y-3 pb-4">
                    <SingleFormContent
                      form={singleForm}
                      panchayaths={panchayaths}
                      wardOptions={wardOptions}
                      potentialParents={potentialParents}
                      isLoadingPanchayaths={isLoadingPanchayaths}
                      needsParent={singleNeedsParent}
                      parentRole={singleParentRole}
                      selectedPanchayath={selectedSinglePanchayath}
                      selectedRole={selectedSingleRole}
                      selectedResponsiblePanchayaths={selectedResponsiblePanchayaths}
                      togglePanchayathSelection={togglePanchayathSelection}
                      toggleWardSelection={(ward) => toggleWardSelection(ward, "single")}
                      getWardsForPanchayath={getWardsForPanchayath}
                    />
                  </form>
                </Form>
              </div>
              <div className="flex justify-end gap-2 px-4 py-3 sm:px-6 sm:py-4 border-t bg-background flex-shrink-0">
                <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button size="sm" disabled={isSubmitting} onClick={singleForm.handleSubmit(onSubmitSingle)}>
                  {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="bulk" className="flex-1 min-h-0 flex flex-col mt-0 data-[state=inactive]:hidden overflow-hidden">
              <div className="flex-1 overflow-y-auto px-4 sm:px-6 pt-3" style={{ minHeight: 0 }}>
                <Form {...bulkForm}>
                  <form className="space-y-3 pb-4">
                    <BulkFormContent
                      form={bulkForm}
                      fields={fields}
                      append={append}
                      remove={remove}
                      panchayaths={panchayaths}
                      wardOptions={wardOptions}
                      potentialParents={potentialParents}
                      isLoadingPanchayaths={isLoadingPanchayaths}
                      needsParent={bulkNeedsParent}
                      parentRole={bulkParentRole}
                      selectedPanchayath={selectedBulkPanchayath}
                      selectedRole={selectedBulkRole}
                      toggleWardSelection={(ward) => toggleWardSelection(ward, "bulk")}
                    />
                  </form>
                </Form>
              </div>
              <div className="flex justify-end gap-2 px-4 py-3 sm:px-6 sm:py-4 border-t bg-background flex-shrink-0">
                <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button size="sm" disabled={isSubmitting} onClick={bulkForm.handleSubmit(onSubmitBulk)}>
                  {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create {fields.length} Agent{fields.length > 1 ? "s" : ""}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Single form content component
interface SingleFormContentProps {
  form: ReturnType<typeof useForm<SingleAgentFormValues>>;
  panchayaths: Panchayath[];
  wardOptions: string[];
  potentialParents: PennyekartAgent[];
  isLoadingPanchayaths: boolean;
  needsParent: boolean;
  parentRole: AgentRole | null;
  selectedPanchayath: string;
  selectedRole: AgentRole;
  selectedResponsiblePanchayaths: string[];
  togglePanchayathSelection: (id: string) => void;
  toggleWardSelection: (ward: string) => void;
  getWardsForPanchayath: (id: string) => string[];
}

function SingleFormContent({
  form,
  panchayaths,
  wardOptions,
  potentialParents,
  isLoadingPanchayaths,
  needsParent,
  parentRole,
  selectedPanchayath,
  selectedRole,
  selectedResponsiblePanchayaths,
  togglePanchayathSelection,
  toggleWardSelection,
  getWardsForPanchayath,
}: SingleFormContentProps) {
  const selectedResponsibleWards = form.watch("responsible_wards") || [];

  return (
    <>
      {/* Personal Details Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-muted-foreground">
          <User className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          Personal Details
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs sm:text-sm">Name</FormLabel>
                <FormControl>
                  <Input placeholder="Agent name" className="h-9" {...field} />
                </FormControl>
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="mobile"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs sm:text-sm">Mobile</FormLabel>
                <FormControl>
                  <Input placeholder="10-digit mobile" maxLength={10} className="h-9" {...field} />
                </FormControl>
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs sm:text-sm">Role</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {ROLE_HIERARCHY.map((role) => (
                      <SelectItem key={role} value={role}>
                        {ROLE_LABELS[role]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="panchayath_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs sm:text-sm">Panchayath</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder={isLoadingPanchayaths ? "Loading..." : "Select"} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {panchayaths.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />
        </div>

        {/* Ward - hide for team leaders */}
        {selectedRole !== "team_leader" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="ward"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs sm:text-sm">Ward</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={wardOptions.length === 0}>
                    <FormControl>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder={
                          !selectedPanchayath 
                            ? "Select panchayath first" 
                            : wardOptions.length === 0 
                              ? "No wards" 
                              : "Select ward"
                        } />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {wardOptions.map((w) => (
                        <SelectItem key={w} value={w}>Ward {w}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            {needsParent && (
              <FormField
                control={form.control}
                name="parent_agent_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs sm:text-sm">
                      Reports To {parentRole ? `(${ROLE_LABELS[parentRole]})` : ""}
                    </FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      value={field.value || ""}
                    >
                      <FormControl>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder={
                            !selectedPanchayath 
                              ? "Select panchayath" 
                              : potentialParents.length === 0 
                                ? "None available" 
                                : "Select"
                          } />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {potentialParents.map((parent) => (
                          <SelectItem key={parent.id} value={parent.id}>
                            {parent.name} (W{parent.ward})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
            )}

            {selectedRole === "pro" && (
              <FormField
                control={form.control}
                name="customer_count"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs sm:text-sm">Customer Count</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min={0}
                        className="h-9"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
            )}
          </div>
        )}
      </div>

      {/* Responsibility Section - Only for Team Leaders and Coordinators */}
      {(selectedRole === "team_leader" || selectedRole === "coordinator") && (
        <>
          <Separator className="my-2" />
          
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Responsibility Scope
            </div>

            {selectedRole === "team_leader" && (
              <FormField
                control={form.control}
                name="responsible_panchayath_ids"
                render={() => (
                  <FormItem>
                    <FormLabel>Responsible Panchayaths</FormLabel>
                    <FormDescription>
                      Select the panchayaths this Team Leader manages (all wards under selected panchayaths will be their responsibility)
                    </FormDescription>
                    <div className="border rounded-lg p-3 max-h-[200px] overflow-y-auto">
                      <div className="grid grid-cols-2 gap-2">
                        {panchayaths.map((p) => (
                          <div key={p.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`panchayath-${p.id}`}
                              checked={selectedResponsiblePanchayaths?.includes(p.id)}
                              onCheckedChange={() => togglePanchayathSelection(p.id)}
                            />
                            <label
                              htmlFor={`panchayath-${p.id}`}
                              className="text-sm cursor-pointer"
                            >
                              {p.name}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                    {selectedResponsiblePanchayaths?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {selectedResponsiblePanchayaths.map(id => {
                          const p = panchayaths.find(pan => pan.id === id);
                          return p ? (
                            <Badge key={id} variant="secondary" className="text-xs">
                              {p.name}
                            </Badge>
                          ) : null;
                        })}
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {selectedRole === "coordinator" && (
              <FormField
                control={form.control}
                name="responsible_wards"
                render={() => (
                  <FormItem>
                    <FormLabel>Responsible Wards</FormLabel>
                    <FormDescription>
                      Select the wards this Coordinator manages (can include their own ward plus others)
                    </FormDescription>
                    {wardOptions.length > 0 ? (
                      <div className="border rounded-lg p-3">
                        <div className="flex flex-wrap gap-2">
                          {wardOptions.map((w) => (
                            <div key={w} className="flex items-center space-x-2">
                              <Checkbox
                                id={`ward-${w}`}
                                checked={selectedResponsibleWards?.includes(w)}
                                onCheckedChange={() => toggleWardSelection(w)}
                              />
                              <label
                                htmlFor={`ward-${w}`}
                                className="text-sm cursor-pointer"
                              >
                                Ward {w}
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Select a panchayath first to see available wards</p>
                    )}
                    {selectedResponsibleWards?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {selectedResponsibleWards.map(w => (
                          <Badge key={w} variant="secondary" className="text-xs">
                            Ward {w}
                          </Badge>
                        ))}
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </div>
        </>
      )}
    </>
  );
}

// Bulk form content component
interface BulkFormContentProps {
  form: ReturnType<typeof useForm<BulkAgentFormValues>>;
  fields: any[];
  append: (value: any) => void;
  remove: (index: number) => void;
  panchayaths: Panchayath[];
  wardOptions: string[];
  potentialParents: PennyekartAgent[];
  isLoadingPanchayaths: boolean;
  needsParent: boolean;
  parentRole: AgentRole | null;
  selectedPanchayath: string;
  selectedRole: AgentRole;
  toggleWardSelection: (ward: string) => void;
}

function BulkFormContent({
  form,
  fields,
  append,
  remove,
  panchayaths,
  wardOptions,
  potentialParents,
  isLoadingPanchayaths,
  needsParent,
  parentRole,
  selectedPanchayath,
  selectedRole,
  toggleWardSelection,
}: BulkFormContentProps) {
  const selectedResponsibleWards = form.watch("responsible_wards") || [];

  return (
    <>
      {/* Common fields for bulk */}
      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="panchayath_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Panchayath</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={isLoadingPanchayaths ? "Loading..." : "Select"} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {panchayaths.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.ward} wards)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Role (for all)</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {ROLE_HIERARCHY.map((role) => (
                    <SelectItem key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {needsParent && (
        <FormField
          control={form.control}
          name="parent_agent_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Reports To ({parentRole ? ROLE_LABELS[parentRole] : ""}) - for all agents
              </FormLabel>
              <Select 
                onValueChange={field.onChange} 
                value={field.value || ""}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={
                      !selectedPanchayath 
                        ? "Select panchayath first" 
                        : potentialParents.length === 0 
                          ? `No ${parentRole ? ROLE_LABELS[parentRole] : "parent"} available` 
                          : "Select parent"
                    } />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {potentialParents.map((parent) => (
                    <SelectItem key={parent.id} value={parent.id}>
                      {parent.name} (Ward {parent.ward})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {/* Coordinator responsibility wards for bulk */}
      {selectedRole === "coordinator" && wardOptions.length > 0 && (
        <FormField
          control={form.control}
          name="responsible_wards"
          render={() => (
            <FormItem>
              <FormLabel>Responsible Wards (for all coordinators)</FormLabel>
              <FormDescription>
                Select the wards these Coordinators will manage
              </FormDescription>
              <div className="border rounded-lg p-3">
                <div className="flex flex-wrap gap-2">
                  {wardOptions.map((w) => (
                    <div key={w} className="flex items-center space-x-2">
                      <Checkbox
                        id={`bulk-ward-${w}`}
                        checked={selectedResponsibleWards?.includes(w)}
                        onCheckedChange={() => toggleWardSelection(w)}
                      />
                      <label
                        htmlFor={`bulk-ward-${w}`}
                        className="text-sm cursor-pointer"
                      >
                        Ward {w}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
              {selectedResponsibleWards?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {selectedResponsibleWards.map(w => (
                    <Badge key={w} variant="secondary" className="text-xs">
                      Ward {w}
                    </Badge>
                  ))}
                </div>
              )}
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {/* Agent list */}
      <div className="border rounded-lg p-3">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium">Agents ({fields.length})</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ name: "", mobile: "", ward: "", customer_count: 0 })}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Row
          </Button>
        </div>

        <div className="space-y-3">
          {fields.map((field, index) => (
            <div key={field.id} className="grid grid-cols-12 gap-2 items-start">
              <div className="col-span-3">
                <FormField
                  control={form.control}
                  name={`agents.${index}.name`}
                  render={({ field }) => (
                    <FormItem>
                      {index === 0 && <FormLabel className="text-xs">Name</FormLabel>}
                      <FormControl>
                        <Input placeholder="Name" {...field} className="h-9" />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />
              </div>
              <div className="col-span-3">
                <FormField
                  control={form.control}
                  name={`agents.${index}.mobile`}
                  render={({ field }) => (
                    <FormItem>
                      {index === 0 && <FormLabel className="text-xs">Mobile</FormLabel>}
                      <FormControl>
                        <Input placeholder="Mobile" maxLength={10} {...field} className="h-9" />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />
              </div>
              <div className="col-span-2">
                <FormField
                  control={form.control}
                  name={`agents.${index}.ward`}
                  render={({ field }) => (
                    <FormItem>
                      {index === 0 && <FormLabel className="text-xs">Own Ward</FormLabel>}
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Ward" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {wardOptions.map((w) => (
                            <SelectItem key={w} value={w}>{w}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />
              </div>
              {selectedRole === "pro" && (
                <div className="col-span-2">
                  <FormField
                    control={form.control}
                    name={`agents.${index}.customer_count`}
                    render={({ field }) => (
                      <FormItem>
                        {index === 0 && <FormLabel className="text-xs">Customers</FormLabel>}
                        <FormControl>
                          <Input 
                            type="number" 
                            min={0}
                            className="h-9"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              )}
              <div className={selectedRole === "pro" ? "col-span-2" : "col-span-4"}>
                {index === 0 && <div className="h-5" />}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-destructive"
                  onClick={() => fields.length > 1 && remove(index)}
                  disabled={fields.length === 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
