import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AgentRole = "scode" | "team_leader" | "coordinator" | "group_leader" | "pro";

export interface PennyekartAgent {
  id: string;
  name: string;
  mobile: string;
  role: AgentRole;
  panchayath_id: string;
  ward: string;
  parent_agent_id: string | null;
  customer_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  // Responsibility scope
  responsible_panchayath_ids: string[]; // For Team Leaders - panchayaths they manage
  responsible_wards: string[]; // For Coordinators - wards they manage
  panchayath?: {
    name: string;
  };
  parent_agent?: {
    name: string;
    role: AgentRole;
  } | null;
  children?: PennyekartAgent[];
}

export interface AgentFilters {
  panchayath_id?: string;
  ward?: string;
  role?: AgentRole;
  search?: string;
}

function getAdminToken(): string | null {
  // Check for admin token (uses elife_admin_token key from useAuth)
  const adminToken = localStorage.getItem("elife_admin_token");
  if (adminToken) {
    return adminToken;
  }
  return null;
}

export function usePennyekartAgents(filters?: AgentFilters) {
  const [agents, setAgents] = useState<PennyekartAgent[]>([]);
  const [hierarchyTree, setHierarchyTree] = useState<PennyekartAgent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAgents = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Use direct Supabase query for reading (RLS allows SELECT for authenticated)
      let query = supabase
        .from("pennyekart_agents")
        .select(`
          *,
          panchayath:panchayaths(name)
        `)
        .order("role", { ascending: true })
        .order("name", { ascending: true });

      if (filters?.panchayath_id) {
        // Match agents by their home panchayath OR by responsible_panchayath_ids (for team leaders managing multiple panchayaths)
        query = query.or(`panchayath_id.eq.${filters.panchayath_id},responsible_panchayath_ids.cs.{${filters.panchayath_id}}`);
      }
      if (filters?.ward) {
        query = query.eq("ward", filters.ward);
      }
      if (filters?.role) {
        query = query.eq("role", filters.role);
      }
      if (filters?.search) {
        query = query.or(`name.ilike.%${filters.search}%,mobile.ilike.%${filters.search}%`);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      const agentsData = (data || []) as unknown as PennyekartAgent[];
      setAgents(agentsData);
      
      // Build hierarchy tree
      const tree = buildHierarchyTree(agentsData);
      setHierarchyTree(tree);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch agents");
    } finally {
      setIsLoading(false);
    }
  }, [filters?.panchayath_id, filters?.ward, filters?.role, filters?.search]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  return { agents, hierarchyTree, isLoading, error, refetch: fetchAgents };
}

function buildHierarchyTree(agents: PennyekartAgent[]): PennyekartAgent[] {
  const agentMap = new Map<string, PennyekartAgent>();
  
  agents.forEach(agent => {
    agentMap.set(agent.id, { ...agent, children: [] });
  });
  
  const rootAgents: PennyekartAgent[] = [];
  
  agentMap.forEach(agent => {
    // Skip self-references to prevent circular loops
    if (agent.parent_agent_id && agent.parent_agent_id !== agent.id && agentMap.has(agent.parent_agent_id)) {
      const parent = agentMap.get(agent.parent_agent_id)!;
      parent.children = parent.children || [];
      parent.children.push(agent);
    } else {
      rootAgents.push(agent);
    }
  });
  
  return rootAgents;
}

export function useAgentMutations() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const callEdgeFunction = async (method: string, body?: object, params?: Record<string, string>) => {
    const token = getAdminToken();
    if (!token) {
      throw new Error("Not authenticated as admin");
    }

    const url = new URL(`${import.meta.env.VITE_SUPABASE_URL || 'https://qnucqwniloioxsowdqzj.supabase.co'}/functions/v1/pennyekart-agents`);
    if (params) {
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    }

    const response = await fetch(url.toString(), {
      method,
      headers: {
        "Content-Type": "application/json",
        "x-admin-token": token,
        "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFudWNxd25pbG9pb3hzb3dkcXpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MDQ3NzcsImV4cCI6MjA4NDk4MDc3N30.hbmuNMcmmFs7-yCYtuJ34jbX6aqWaSDTiryD1VDHFKc",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Request failed");
    }
    return data;
  };

  const createAgent = async (agentData: Omit<PennyekartAgent, "id" | "created_at" | "updated_at" | "panchayath" | "parent_agent" | "children" | "created_by">) => {
    setIsSubmitting(true);
    try {
      const result = await callEdgeFunction("POST", { action: "create", agent: agentData });
      return { data: result.data, error: null };
    } catch (err) {
      return { data: null, error: err instanceof Error ? err.message : "Failed to create agent" };
    } finally {
      setIsSubmitting(false);
    }
  };

  const createBulkAgents = async (agents: Array<Omit<PennyekartAgent, "id" | "created_at" | "updated_at" | "panchayath" | "parent_agent" | "children" | "created_by">>) => {
    setIsSubmitting(true);
    try {
      const result = await callEdgeFunction("POST", { action: "bulk_create", agents });
      return { data: result.data, count: result.count, error: null };
    } catch (err) {
      return { data: null, count: 0, error: err instanceof Error ? err.message : "Failed to create agents" };
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateAgent = async (id: string, updates: Partial<PennyekartAgent>) => {
    setIsSubmitting(true);
    try {
      const result = await callEdgeFunction("PUT", { id, agent: updates });
      return { data: result.data, error: null };
    } catch (err) {
      return { data: null, error: err instanceof Error ? err.message : "Failed to update agent" };
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteAgent = async (id: string) => {
    setIsSubmitting(true);
    try {
      await callEdgeFunction("DELETE", undefined, { id });
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Failed to delete agent" };
    } finally {
      setIsSubmitting(false);
    }
  };

  return { createAgent, createBulkAgents, updateAgent, deleteAgent, isSubmitting };
}

export const ROLE_LABELS: Record<AgentRole, string> = {
  team_leader: "Team Leader",
  coordinator: "Coordinator",
  group_leader: "Group Leader",
  pro: "PRO"
};

export const ROLE_HIERARCHY: AgentRole[] = ["team_leader", "coordinator", "group_leader", "pro"];

export function getParentRole(role: AgentRole): AgentRole | null {
  const index = ROLE_HIERARCHY.indexOf(role);
  return index > 0 ? ROLE_HIERARCHY[index - 1] : null;
}

export function getChildRole(role: AgentRole): AgentRole | null {
  const index = ROLE_HIERARCHY.indexOf(role);
  return index < ROLE_HIERARCHY.length - 1 ? ROLE_HIERARCHY[index + 1] : null;
}
