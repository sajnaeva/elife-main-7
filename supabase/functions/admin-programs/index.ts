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

    // Get admin token from header
    const adminToken = req.headers.get("x-admin-token");
    if (!adminToken) {
      return new Response(
        JSON.stringify({ error: "Admin token required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify token
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

    const body = await req.json();
    const { action, data } = body;

    switch (action) {
      case "create": {
        console.log("Creating program for admin:", adminPayload.admin_id);
        
        // Validate division access - admin can only create for their division
        if (data.division_id !== admin.division_id) {
          return new Response(
            JSON.stringify({ error: "You can only create programs for your division" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: program, error: insertError } = await supabase
          .from("programs")
          .insert({
            name: data.name,
            description: data.description || null,
            division_id: data.division_id,
            panchayath_id: data.all_panchayaths ? null : data.panchayath_id,
            all_panchayaths: data.all_panchayaths || false,
            start_date: data.start_date || null,
            end_date: data.end_date || null,
            created_by: adminPayload.user_id,
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
          JSON.stringify({ success: true, program }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "update": {
        console.log("Updating program:", data.id);
        
        // First check if program belongs to admin's division
        const { data: existingProgram, error: fetchError } = await supabase
          .from("programs")
          .select("division_id")
          .eq("id", data.id)
          .single();

        if (fetchError || !existingProgram) {
          return new Response(
            JSON.stringify({ error: "Program not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (existingProgram.division_id !== admin.division_id) {
          return new Response(
            JSON.stringify({ error: "You can only update programs in your division" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const updateData: Record<string, unknown> = {};
        if (data.name !== undefined) updateData.name = data.name;
        if (data.description !== undefined) updateData.description = data.description;
        if (data.is_active !== undefined) updateData.is_active = data.is_active;
        if (data.start_date !== undefined) updateData.start_date = data.start_date;
        if (data.end_date !== undefined) updateData.end_date = data.end_date;
        if (data.verification_enabled !== undefined) updateData.verification_enabled = data.verification_enabled;
        if (data.all_panchayaths !== undefined) {
          updateData.all_panchayaths = data.all_panchayaths;
          updateData.panchayath_id = data.all_panchayaths ? null : data.panchayath_id;
        }

        const { data: program, error: updateError } = await supabase
          .from("programs")
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
          JSON.stringify({ success: true, program }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "delete": {
        console.log("Deleting program:", data.id);
        
        // First check if program belongs to admin's division
        const { data: existingProgram, error: fetchError } = await supabase
          .from("programs")
          .select("division_id")
          .eq("id", data.id)
          .single();

        if (fetchError || !existingProgram) {
          return new Response(
            JSON.stringify({ error: "Program not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (existingProgram.division_id !== admin.division_id) {
          return new Response(
            JSON.stringify({ error: "You can only delete programs in your division" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { error: deleteError } = await supabase
          .from("programs")
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
    console.error("Error in admin-programs:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
