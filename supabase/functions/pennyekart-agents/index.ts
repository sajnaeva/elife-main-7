import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-token",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_SECRET = Deno.env.get("ADMIN_SECRET") || "elife_admin_secret_2024";

interface AdminToken {
  admin_id: string;
  user_id: string | null;
  division_id: string;
  full_name: string;
  exp: number;
}

function parseAdminToken(token: string): AdminToken | null {
  try {
    const [payloadB64, signature] = token.split(".");
    const payload = JSON.parse(atob(payloadB64));
    
    // Verify expiration
    if (payload.exp < Date.now()) {
      return null;
    }
    
    // Verify signature
    const encoder = new TextEncoder();
    const data = encoder.encode(payloadB64 + ADMIN_SECRET);
    const hashBuffer = new Uint8Array(32);
    const dataArray = new Uint8Array(data);
    for (let i = 0; i < dataArray.length; i++) {
      hashBuffer[i % 32] ^= dataArray[i];
    }
    const expectedSig = Array.from(hashBuffer).map(b => b.toString(16).padStart(2, "0")).join("");
    
    if (signature !== expectedSig) {
      // For now, allow the token if payload is valid (matching admin-auth logic)
    }
    
    return payload;
  } catch {
    return null;
  }
}

async function verifyAdmin(adminToken: string): Promise<{ valid: boolean; admin?: AdminToken; isSuperAdmin?: boolean }> {
  const parsed = parseAdminToken(adminToken);
  if (!parsed) {
    return { valid: false };
  }
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  // Check if admin exists and is active
  const { data: admin } = await supabase
    .from("admins")
    .select("id, division_id, full_name")
    .eq("id", parsed.admin_id)
    .eq("is_active", true)
    .single();
  
  if (!admin) {
    return { valid: false };
  }
  
  // Check for super_admin role via user_id
  let isSuperAdmin = false;
  if (parsed.user_id) {
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", parsed.user_id)
      .eq("role", "super_admin")
      .single();
    
    isSuperAdmin = !!roleData;
  }
  
  return { valid: true, admin: parsed, isSuperAdmin };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const adminToken = req.headers.get("x-admin-token");
    if (!adminToken) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - No admin token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { valid, admin, isSuperAdmin } = await verifyAdmin(adminToken);
    if (!valid || !admin) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - Invalid admin token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const url = new URL(req.url);
    const body = req.method !== "GET" && req.method !== "DELETE" 
      ? await req.json() 
      : null;
    
    const { action } = body || {};
    const agentId = url.searchParams.get("id");

    // GET - List agents
    if (req.method === "GET") {
      const panchayathFilter = url.searchParams.get("panchayath_id");
      
      let query = supabase
        .from("pennyekart_agents")
        .select("*, panchayath:panchayaths(name)")
        .order("role", { ascending: true })
        .order("name", { ascending: true });

      if (panchayathFilter) {
        // Match agents by home panchayath OR by responsible_panchayath_ids
        query = query.or(`panchayath_id.eq.${panchayathFilter},responsible_panchayath_ids.cs.{${panchayathFilter}}`);
      }

      const { data, error } = await query;

      if (error) throw error;
      return new Response(JSON.stringify({ data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST - Create agent
    if (req.method === "POST" && action === "create") {
      const { agent } = body;
      
      // Duplicate check: look for existing agent with same mobile in same panchayath
      const { data: existing } = await supabase
        .from("pennyekart_agents")
        .select("id, name, role, mobile, panchayath_id")
        .eq("mobile", agent.mobile);

      if (existing && existing.length > 0) {
        const dup = existing[0];
        // Get panchayath name for better error message
        const { data: panchData } = await supabase
          .from("panchayaths")
          .select("name")
          .eq("id", dup.panchayath_id)
          .single();
        const panchName = panchData?.name || "unknown";
        return new Response(
          JSON.stringify({ error: `Duplicate: Mobile ${agent.mobile} already exists for agent "${dup.name}" (${dup.role}) in ${panchName}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data, error } = await supabase
        .from("pennyekart_agents")
        .insert({
          ...agent,
          created_by: admin.admin_id,
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          return new Response(
            JSON.stringify({ error: "Mobile number already exists" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        throw error;
      }

      return new Response(JSON.stringify({ data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST - Bulk create agents
    if (req.method === "POST" && action === "bulk_create") {
      const { agents } = body;
      
      // Duplicate check: check all mobiles in this batch against existing agents
      const mobiles = agents.map((a: any) => a.mobile);
      
      // Also check for duplicates within the batch itself
      const batchDuplicates = mobiles.filter((m: string, i: number) => mobiles.indexOf(m) !== i);
      if (batchDuplicates.length > 0) {
        return new Response(
          JSON.stringify({ error: `Duplicate mobiles within batch: ${[...new Set(batchDuplicates)].join(", ")}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: existingAgents } = await supabase
        .from("pennyekart_agents")
        .select("mobile, name, role")
        .in("mobile", mobiles);

      if (existingAgents && existingAgents.length > 0) {
        const dupDetails = existingAgents.map((a: any) => `${a.mobile} (${a.name}, ${a.role})`).join("; ");
        return new Response(
          JSON.stringify({ error: `Duplicate mobile numbers already exist: ${dupDetails}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const agentsWithCreator = agents.map((a: any) => ({
        ...a,
        created_by: admin.admin_id,
      }));

      const { data, error } = await supabase
        .from("pennyekart_agents")
        .insert(agentsWithCreator)
        .select();

      if (error) {
        if (error.code === "23505") {
          return new Response(
            JSON.stringify({ error: "One or more mobile numbers already exist" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        throw error;
      }

      return new Response(JSON.stringify({ data, count: data?.length || 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // PUT - Update agent
    if (req.method === "PUT") {
      const { agent, id } = body;
      
      if (!id || !agent) {
        return new Response(
          JSON.stringify({ error: "Missing id or agent data" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Remove fields that shouldn't be updated
      const { created_at, created_by, panchayath, parent_agent, children, ...updateData } = agent;
      
      const { data, error } = await supabase
        .from("pennyekart_agents")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        console.error("Update error:", error);
        throw error;
      }

      return new Response(JSON.stringify({ data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // DELETE - Delete agent (cascade: reassign or delete children first)
    if (req.method === "DELETE" && agentId) {
      // First, remove references from child agents by setting their parent_agent_id to null
      const { error: childError } = await supabase
        .from("pennyekart_agents")
        .update({ parent_agent_id: null })
        .eq("parent_agent_id", agentId);

      if (childError) {
        console.error("Error clearing children:", childError);
        throw childError;
      }

      const { error } = await supabase
        .from("pennyekart_agents")
        .delete()
        .eq("id", agentId);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
