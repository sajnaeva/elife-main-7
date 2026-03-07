import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { phone, password, action } = await req.json();
    
    if (action === "refresh") {
      // Refresh admin data by admin ID - no phone/password needed
      const adminToken = req.headers.get("x-admin-token");
      if (!adminToken) {
        return new Response(
          JSON.stringify({ error: "Admin token required" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      try {
        const [payload] = adminToken.split(".");
        const decoded = JSON.parse(atob(payload));
        
        if (!decoded.admin_id || (decoded.exp && decoded.exp < Date.now())) {
          return new Response(
            JSON.stringify({ error: "Invalid or expired token" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: admin, error: adminError } = await supabase
          .from("admins")
          .select("id, user_id, division_id, full_name, access_all_divisions, additional_division_ids, is_active, is_read_only, cash_collection_enabled")
          .eq("id", decoded.admin_id)
          .single();

        if (adminError || !admin || !admin.is_active) {
          return new Response(
            JSON.stringify({ error: "Admin not found or inactive" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            admin: {
              id: admin.id,
              user_id: admin.user_id,
              division_id: admin.division_id,
              full_name: admin.full_name,
              access_all_divisions: admin.access_all_divisions,
              additional_division_ids: admin.additional_division_ids,
              is_read_only: admin.is_read_only,
              cash_collection_enabled: admin.cash_collection_enabled,
            },
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch {
        return new Response(
          JSON.stringify({ error: "Invalid token" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (action === "login") {
      if (!phone || !password) {
        return new Response(
          JSON.stringify({ error: "Phone and password are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Normalize phone number (remove spaces, ensure format)
      const normalizedPhone = phone.replace(/\s+/g, "").trim();
      console.log("Admin login attempt for phone:", normalizedPhone);
      
      // Find admin by phone
      const { data: admin, error: adminError } = await supabase
        .from("admins")
        .select("id, user_id, password_hash, is_active, division_id, full_name, access_all_divisions, additional_division_ids, is_read_only, cash_collection_enabled")
        .eq("phone", normalizedPhone)
        .single();
      
      if (adminError || !admin) {
        console.log("Admin not found:", adminError?.message);
        return new Response(
          JSON.stringify({ error: "Invalid phone number or password" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (!admin.is_active) {
        console.log("Admin account is inactive");
        return new Response(
          JSON.stringify({ error: "Your account has been deactivated. Contact Super Admin." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (!admin.password_hash) {
        console.log("Admin password not set");
        return new Response(
          JSON.stringify({ error: "Password not set. Contact Super Admin." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Verify password using bcrypt
      const encoder = new TextEncoder();
      const data = encoder.encode(password);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashedPassword = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
      
      if (hashedPassword !== admin.password_hash) {
        console.log("Password mismatch");
        return new Response(
          JSON.stringify({ error: "Invalid phone number or password" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Generate a custom session token for the admin
      const tokenPayload = {
        admin_id: admin.id,
        user_id: admin.user_id,
        division_id: admin.division_id,
        full_name: admin.full_name,
        exp: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
      };
      
      // Sign the token
      const tokenData = JSON.stringify(tokenPayload);
      const tokenEncoder = new TextEncoder();
      const tokenBuffer = tokenEncoder.encode(tokenData + supabaseServiceKey);
      const signatureBuffer = await crypto.subtle.digest("SHA-256", tokenBuffer);
      const signatureArray = Array.from(new Uint8Array(signatureBuffer));
      const signature = signatureArray.map(b => b.toString(16).padStart(2, "0")).join("");
      
      const token = btoa(tokenData) + "." + signature;
      
      console.log("Admin login successful");
      
      return new Response(
        JSON.stringify({
          success: true,
          token,
          admin: {
            id: admin.id,
            user_id: admin.user_id,
            division_id: admin.division_id,
            full_name: admin.full_name,
            access_all_divisions: admin.access_all_divisions,
            additional_division_ids: admin.additional_division_ids,
            is_read_only: admin.is_read_only,
            cash_collection_enabled: admin.cash_collection_enabled,
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error) {
    console.error("Error in admin-auth:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
