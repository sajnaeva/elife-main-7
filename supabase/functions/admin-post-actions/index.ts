import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { action, post_id, user_id, reason } = await req.json();

    if (!action || !post_id || !user_id) {
      return new Response(
        JSON.stringify({ error: "action, post_id, and user_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with service role for admin access
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Verify user is an admin by checking user_roles table.
    // NOTE: Do not fall back to checking profiles.role (roles must live in user_roles).
    // Also avoid maybeSingle() because a user can have multiple admin roles.
    const { data: adminRoles, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user_id)
      .limit(1);

    if (roleError) {
      console.error("Role check error:", roleError);
      return new Response(
        JSON.stringify({ error: "Failed to verify admin status" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isAdmin = Array.isArray(adminRoles) && adminRoles.length > 0;
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Perform the requested action
    if (action === "hide") {
      const { error: updateError } = await supabase
        .from("posts")
        .update({
          is_hidden: true,
          hidden_at: new Date().toISOString(),
          hidden_reason: reason || "Hidden by admin due to report",
        })
        .eq("id", post_id);

      if (updateError) {
        console.error("Hide post error:", updateError);
        return new Response(
          JSON.stringify({ error: updateError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Log the action
      await supabase.from("admin_activity_logs").insert({
        admin_id: user_id,
        action: "hide_post",
        target_type: "post",
        target_id: post_id,
        details: { reason: reason || "Hidden by admin due to report" },
      });

      return new Response(
        JSON.stringify({ success: true, message: "Post hidden successfully" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else if (action === "delete") {
      // Cleanup related rows first to avoid FK constraint errors
      const { error: likesError } = await supabase
        .from("post_likes")
        .delete()
        .eq("post_id", post_id);

      if (likesError) {
        console.error("Delete post likes error:", likesError);
        return new Response(
          JSON.stringify({ error: likesError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: commentsError } = await supabase
        .from("comments")
        .delete()
        .eq("post_id", post_id);

      if (commentsError) {
        console.error("Delete post comments error:", commentsError);
        return new Response(
          JSON.stringify({ error: commentsError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: reportsError } = await supabase
        .from("reports")
        .delete()
        .eq("reported_id", post_id)
        .eq("reported_type", "post");

      if (reportsError) {
        console.error("Delete post reports error:", reportsError);
        return new Response(
          JSON.stringify({ error: reportsError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: deleteError } = await supabase
        .from("posts")
        .delete()
        .eq("id", post_id);

      if (deleteError) {
        console.error("Delete post error:", deleteError);
        return new Response(
          JSON.stringify({ error: deleteError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Log the action
      await supabase.from("admin_activity_logs").insert({
        admin_id: user_id,
        action: "delete_post",
        target_type: "post",
        target_id: post_id,
        details: { reason: reason || "Deleted by admin" },
      });

      return new Response(
        JSON.stringify({ success: true, message: "Post deleted successfully" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else if (action === "unhide") {
      const { error: updateError } = await supabase
        .from("posts")
        .update({
          is_hidden: false,
          hidden_at: null,
          hidden_reason: null,
        })
        .eq("id", post_id);

      if (updateError) {
        console.error("Unhide post error:", updateError);
        return new Response(
          JSON.stringify({ error: updateError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Log the action
      await supabase.from("admin_activity_logs").insert({
        admin_id: user_id,
        action: "unhide_post",
        target_type: "post",
        target_id: post_id,
        details: {},
      });

      return new Response(
        JSON.stringify({ success: true, message: "Post unhidden successfully" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      return new Response(
        JSON.stringify({ error: "Invalid action. Use 'hide', 'unhide', or 'delete'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error: unknown) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
