import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-session-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const sessionToken = req.headers.get("x-session-token");
    if (!sessionToken) {
      console.log("Missing session token");
      return new Response(
        JSON.stringify({ error: "Missing session token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate admin session
    const { data: sessions, error: sessionError } = await supabaseAdmin
      .from("user_sessions")
      .select("user_id, expires_at, is_active")
      .eq("session_token", sessionToken)
      .eq("is_active", true)
      .gt("expires_at", new Date().toISOString())
      .limit(1);

    if (sessionError || !sessions || sessions.length === 0) {
      console.log("Session validation failed:", sessionError?.message || "No session found");
      return new Response(
        JSON.stringify({ error: "Invalid or expired session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const session = sessions[0];

    // Check if user has admin role
    const { data: roles, error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user_id);

    if (rolesError || !roles || roles.length === 0) {
      console.log("No admin roles found for user");
      return new Response(
        JSON.stringify({ error: "Unauthorized: No admin roles" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { action, entity_type, entity_id, updates } = body;
    console.log("Admin action:", action, "entity:", entity_type, "id:", entity_id);

    let result;

    switch (action) {
      case "list": {
        if (entity_type === "communities") {
          const { data, error } = await supabaseAdmin
            .from("communities")
            .select(`
              id, name, description, cover_image_url, is_disabled, approval_status, 
              created_at, created_by, disabled_at, disabled_reason,
              profiles!communities_created_by_fkey(full_name, username)
            `)
            .order("created_at", { ascending: false });

          if (error) {
            console.error("Error fetching communities:", error);
            throw error;
          }

          // Get member counts separately
          const communityIds = (data || []).map(c => c.id);
          const { data: memberCounts } = await supabaseAdmin
            .from("community_members")
            .select("community_id")
            .in("community_id", communityIds);

          const countMap: Record<string, number> = {};
          (memberCounts || []).forEach(m => {
            countMap[m.community_id] = (countMap[m.community_id] || 0) + 1;
          });

          const communities = (data || []).map(c => ({
            ...c,
            creator: c.profiles,
            profiles: undefined,
            member_count: countMap[c.id] || 0,
          }));

          result = { data: communities };
        } else if (entity_type === "businesses") {
          const { data, error } = await supabaseAdmin
            .from("businesses")
            .select(`
              id, name, category, location, is_featured, is_disabled, approval_status,
              created_at, owner_id, disabled_reason,
              profiles!businesses_owner_id_fkey(full_name, username)
            `)
            .order("created_at", { ascending: false });

          if (error) {
            console.error("Error fetching businesses:", error);
            throw error;
          }

          const businesses = (data || []).map(b => ({
            ...b,
            owner: b.profiles,
            profiles: undefined,
          }));

          result = { data: businesses };
        } else if (entity_type === "jobs") {
          const { data, error } = await supabaseAdmin
            .from("jobs")
            .select(`
              id, title, description, location, status, approval_status,
              created_at, creator_id,
              profiles!jobs_creator_id_fkey(full_name, username)
            `)
            .order("created_at", { ascending: false });

          if (error) {
            console.error("Error fetching jobs:", error);
            throw error;
          }

          // Get application counts
          const jobIds = (data || []).map(j => j.id);
          const { data: appCounts } = await supabaseAdmin
            .from("job_applications")
            .select("job_id")
            .in("job_id", jobIds);

          const countMap: Record<string, number> = {};
          (appCounts || []).forEach(a => {
            countMap[a.job_id] = (countMap[a.job_id] || 0) + 1;
          });

          const jobs = (data || []).map(j => ({
            ...j,
            creator: j.profiles,
            profiles: undefined,
            application_count: countMap[j.id] || 0,
          }));

          result = { data: jobs };
        } else {
          throw new Error("Unknown entity type: " + entity_type);
        }
        break;
      }

      case "update": {
        if (!entity_id || !updates) {
          throw new Error("Missing entity_id or updates");
        }

        let tableName = "";
        if (entity_type === "communities") tableName = "communities";
        else if (entity_type === "businesses") tableName = "businesses";
        else if (entity_type === "jobs") tableName = "jobs";
        else throw new Error("Unknown entity type: " + entity_type);

        const { error } = await supabaseAdmin
          .from(tableName)
          .update(updates)
          .eq("id", entity_id);

        if (error) {
          console.error("Error updating:", error);
          throw error;
        }

        // Log activity
        await supabaseAdmin.from("admin_activity_logs").insert({
          admin_id: session.user_id,
          action: `Updated ${entity_type}: ${JSON.stringify(updates)}`,
          target_type: entity_type.slice(0, -1),
          target_id: entity_id,
        });

        result = { success: true };
        break;
      }

      case "delete": {
        if (!entity_id) {
          throw new Error("Missing entity_id");
        }

        let tableName = "";
        if (entity_type === "communities") {
          // Delete community members first
          await supabaseAdmin.from("community_members").delete().eq("community_id", entity_id);
          await supabaseAdmin.from("community_permissions").delete().eq("community_id", entity_id);
          await supabaseAdmin.from("community_discussions").delete().eq("community_id", entity_id);
          await supabaseAdmin.from("community_poll_votes").delete().in("poll_id", 
            (await supabaseAdmin.from("community_polls").select("id").eq("community_id", entity_id)).data?.map(p => p.id) || []
          );
          await supabaseAdmin.from("community_poll_options").delete().in("poll_id",
            (await supabaseAdmin.from("community_polls").select("id").eq("community_id", entity_id)).data?.map(p => p.id) || []
          );
          await supabaseAdmin.from("community_polls").delete().eq("community_id", entity_id);
          tableName = "communities";
        } else if (entity_type === "businesses") {
          // Delete business follows first
          await supabaseAdmin.from("business_follows").delete().eq("business_id", entity_id);
          await supabaseAdmin.from("business_images").delete().eq("business_id", entity_id);
          tableName = "businesses";
        } else if (entity_type === "jobs") {
          // Delete job applications first
          await supabaseAdmin.from("job_applications").delete().eq("job_id", entity_id);
          tableName = "jobs";
        } else {
          throw new Error("Unknown entity type: " + entity_type);
        }

        const { error } = await supabaseAdmin
          .from(tableName)
          .delete()
          .eq("id", entity_id);

        if (error) {
          console.error("Error deleting:", error);
          throw error;
        }

        // Log activity
        await supabaseAdmin.from("admin_activity_logs").insert({
          admin_id: session.user_id,
          action: `Deleted ${entity_type}`,
          target_type: entity_type.slice(0, -1),
          target_id: entity_id,
        });

        result = { success: true };
        break;
      }

      default:
        throw new Error("Unknown action: " + action);
    }

    console.log("Action completed successfully");
    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Admin manage error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
