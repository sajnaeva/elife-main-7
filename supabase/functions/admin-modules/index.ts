import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-token",
};

interface AdminTokenPayload {
  admin_id: string;
  user_id: string;
  division_id: string;
  exp: number;
}

async function verifyAdminToken(token: string, serviceKey: string): Promise<AdminTokenPayload | null> {
  try {
    const [payloadBase64, signature] = token.split(".");
    if (!payloadBase64 || !signature) return null;

    const tokenData = atob(payloadBase64);
    const payload: AdminTokenPayload = JSON.parse(tokenData);

    // Check expiry
    if (payload.exp < Date.now()) {
      console.log("Token expired");
      return null;
    }

    // Verify signature
    const tokenEncoder = new TextEncoder();
    const tokenBuffer = tokenEncoder.encode(tokenData + serviceKey);
    const signatureBuffer = await crypto.subtle.digest("SHA-256", tokenBuffer);
    const signatureArray = Array.from(new Uint8Array(signatureBuffer));
    const expectedSignature = signatureArray.map(b => b.toString(16).padStart(2, "0")).join("");

    if (signature !== expectedSignature) {
      console.log("Invalid signature");
      return null;
    }

    return payload;
  } catch (error) {
    console.error("Token verification error:", error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Support both admin token and Supabase JWT (for super_admin)
    const adminToken = req.headers.get("x-admin-token");
    const authHeader = req.headers.get("authorization");
    
    let divisionId: string;
    let adminId: string;

    if (adminToken) {
      // Verify custom admin token
      const adminPayload = await verifyAdminToken(adminToken, supabaseServiceKey);
      if (!adminPayload) {
        return new Response(
          JSON.stringify({ error: "Invalid or expired token" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify admin is still active
      const { data: admin, error: adminError } = await supabase
        .from("admins")
        .select("id, is_active, division_id")
        .eq("id", adminPayload.admin_id)
        .single();

      if (adminError || !admin || !admin.is_active) {
        return new Response(
          JSON.stringify({ error: "Admin account not found or inactive" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      divisionId = admin.division_id;
      adminId = admin.id;
    } else if (authHeader) {
      // Verify Supabase JWT for super_admin
      const token = authHeader.replace("Bearer ", "");
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: { user }, error: userError } = await userClient.auth.getUser(token);
      
      if (userError || !user) {
        return new Response(
          JSON.stringify({ error: "Invalid authorization" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if super_admin
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "super_admin")
        .single();

      if (!roleData) {
        return new Response(
          JSON.stringify({ error: "Insufficient permissions" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Super admin can access all divisions
      divisionId = "__super_admin__";
      adminId = user.id;
    } else {
      return new Response(
        JSON.stringify({ error: "Admin token required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { action, data } = body;

    // Helper to verify program belongs to admin's division
    async function verifyProgramAccess(programId: string): Promise<boolean> {
      if (divisionId === "__super_admin__") return true;
      const { data: program, error } = await supabase
        .from("programs")
        .select("division_id")
        .eq("id", programId)
        .single();

      if (error || !program) return false;
      return program.division_id === divisionId;
    }

    switch (action) {
      case "create": {
        console.log("Creating module for program:", data.program_id);
        
        if (!(await verifyProgramAccess(data.program_id))) {
          return new Response(
            JSON.stringify({ error: "You can only manage modules for programs in your division" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: module, error: insertError } = await supabase
          .from("program_modules")
          .insert({
            program_id: data.program_id,
            module_type: data.module_type,
            is_published: data.is_published || false,
          })
          .select()
          .single();

        if (insertError) {
          console.error("Insert error:", insertError);
          return new Response(
            JSON.stringify({ error: insertError.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, module }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "update": {
        console.log("Updating module:", data.id);
        
        // Get module to check program access
        const { data: existingModule, error: fetchError } = await supabase
          .from("program_modules")
          .select("program_id")
          .eq("id", data.id)
          .single();

        if (fetchError || !existingModule) {
          return new Response(
            JSON.stringify({ error: "Module not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (!(await verifyProgramAccess(existingModule.program_id))) {
          return new Response(
            JSON.stringify({ error: "You can only manage modules for programs in your division" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const updateData: Record<string, unknown> = {};
        if (data.is_published !== undefined) updateData.is_published = data.is_published;

        const { data: module, error: updateError } = await supabase
          .from("program_modules")
          .update(updateData)
          .eq("id", data.id)
          .select()
          .single();

        if (updateError) {
          console.error("Update error:", updateError);
          return new Response(
            JSON.stringify({ error: updateError.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, module }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "delete": {
        console.log("Deleting module:", data.id);
        
        // Get module to check program access
        const { data: existingModule, error: fetchError } = await supabase
          .from("program_modules")
          .select("program_id")
          .eq("id", data.id)
          .single();

        if (fetchError || !existingModule) {
          return new Response(
            JSON.stringify({ error: "Module not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (!(await verifyProgramAccess(existingModule.program_id))) {
          return new Response(
            JSON.stringify({ error: "You can only manage modules for programs in your division" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { error: deleteError } = await supabase
          .from("program_modules")
          .delete()
          .eq("id", data.id);

        if (deleteError) {
          console.error("Delete error:", deleteError);
          return new Response(
            JSON.stringify({ error: deleteError.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: "Invalid action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error) {
    console.error("Error in admin-modules:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
