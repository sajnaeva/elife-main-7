import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-token",
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const adminToken = req.headers.get("x-admin-token");
    if (!adminToken) {
      return new Response(
        JSON.stringify({ error: "Admin token required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate admin token
    const [payload] = adminToken.split(".");
    const decoded = JSON.parse(atob(payload));
    
    if (!decoded.exp || decoded.exp <= Date.now()) {
      return new Response(
        JSON.stringify({ error: "Token expired" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminId = decoded.admin_id;
    const divisionId = decoded.division_id;

    if (!adminId || !divisionId) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch admin record to check multi-division access
    const { data: adminRecord } = await supabase
      .from("admins")
      .select("access_all_divisions, additional_division_ids")
      .eq("id", adminId)
      .single();

    const accessAllDivisions = adminRecord?.access_all_divisions ?? false;
    const additionalDivisionIds: string[] = adminRecord?.additional_division_ids ?? [];

    const canAccessDivision = (targetDivisionId: string) => {
      if (accessAllDivisions) return true;
      if (targetDivisionId === divisionId) return true;
      if (additionalDivisionIds.includes(targetDivisionId)) return true;
      return false;
    };

    const url = new URL(req.url);

    // Handle PUT for verification updates or rank updates
    if (req.method === "PUT") {
      const body = await req.json();
      const { registration_id, verification_scores, total_score, max_score, percentage, rank } = body;

      if (!registration_id) {
        return new Response(
          JSON.stringify({ error: "registration_id is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get the registration to verify program ownership
      const { data: registration, error: regFetchError } = await supabase
        .from("program_registrations")
        .select("program_id")
        .eq("id", registration_id)
        .single();

      if (regFetchError || !registration) {
        return new Response(
          JSON.stringify({ error: "Registration not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify the program belongs to the admin's division
      const { data: program, error: programError } = await supabase
        .from("programs")
        .select("division_id")
        .eq("id", registration.program_id)
        .single();

      if (programError || !program) {
        return new Response(
          JSON.stringify({ error: "Program not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!canAccessDivision(program.division_id)) {
        return new Response(
          JSON.stringify({ error: "Access denied: Program belongs to different division" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Build update object based on what's provided
      const updateData: Record<string, any> = {};

      // If it's a verification update
      if (verification_scores !== undefined) {
        updateData.verification_scores = verification_scores;
        updateData.total_score = total_score;
        updateData.max_score = max_score;
        updateData.percentage = Math.round(percentage * 100) / 100;
        updateData.verified_by = adminId;
        updateData.verified_at = new Date().toISOString();
        updateData.verification_status = "verified";
      }

      // If it's a rank update
      if (rank !== undefined) {
        updateData.rank = rank === null || rank === "" ? null : parseInt(rank);
      }

      // Update the registration
      const { error: updateError } = await supabase
        .from("program_registrations")
        .update(updateData)
        .eq("id", registration_id);

      if (updateError) {
        console.error("Error updating registration:", updateError);
        return new Response(
          JSON.stringify({ error: "Failed to update registration" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GET - Fetch registrations
    const programId = url.searchParams.get("program_id");

    if (!programId) {
      return new Response(
        JSON.stringify({ error: "program_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the program belongs to the admin's division
    const { data: program, error: programError } = await supabase
      .from("programs")
      .select("division_id")
      .eq("id", programId)
      .single();

    if (programError || !program) {
      return new Response(
        JSON.stringify({ error: "Program not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!canAccessDivision(program.division_id)) {
      return new Response(
        JSON.stringify({ error: "Access denied: Program belongs to different division" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch registrations
    const { data: registrations, error: regError } = await supabase
      .from("program_registrations")
      .select("*")
      .eq("program_id", programId)
      .order("created_at", { ascending: false });

    if (regError) {
      console.error("Error fetching registrations:", regError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch registrations" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ registrations }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});