import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-session-token",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing required env vars");
      return new Response(
        JSON.stringify({ error: "Server not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate session token
    const sessionToken = req.headers.get("x-session-token");
    if (!sessionToken) {
      return new Response(
        JSON.stringify({ error: "No session token provided" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: userId, error: sessionError } = await supabase
      .rpc("validate_session", { p_session_token: sessionToken });

    if (sessionError || !userId) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { action, community_id, name, description, cover_image_url, discussion_id, member_user_id, target_user_id, permission } = await req.json();

    // CREATE community
    if (action === "create") {
      if (!name?.trim()) {
        return new Response(
          JSON.stringify({ error: "Community name is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create the community with pending approval status
      const { data: community, error: createError } = await supabase
        .from("communities")
        .insert({
          name: name.trim(),
          description: description?.trim() || null,
          cover_image_url: cover_image_url || null,
          created_by: userId,
          approval_status: 'pending', // Require admin approval
        })
        .select()
        .single();

      if (createError) {
        console.error("Create community error:", createError);
        return new Response(
          JSON.stringify({ error: createError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Auto-join creator as admin
      const { error: memberError } = await supabase
        .from("community_members")
        .insert({
          community_id: community.id,
          user_id: userId,
          role: "admin",
        });

      if (memberError) {
        console.error("Add member error:", memberError);
      }

      return new Response(
        JSON.stringify({ success: true, community }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // UPDATE community
    if (action === "update") {
      if (!community_id) {
        return new Response(
          JSON.stringify({ error: "Community ID is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify ownership
      const { data: existingCommunity } = await supabase
        .from("communities")
        .select("created_by")
        .eq("id", community_id)
        .single();

      if (!existingCommunity || existingCommunity.created_by !== userId) {
        return new Response(
          JSON.stringify({ error: "Not authorized to update this community" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: updateError } = await supabase
        .from("communities")
        .update({
          name: name?.trim(),
          description: description?.trim() || null,
          cover_image_url: cover_image_url || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", community_id);

      if (updateError) {
        console.error("Update community error:", updateError);
        return new Response(
          JSON.stringify({ error: updateError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // DELETE community
    if (action === "delete") {
      if (!community_id) {
        return new Response(
          JSON.stringify({ error: "Community ID is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify ownership
      const { data: existingCommunity } = await supabase
        .from("communities")
        .select("created_by")
        .eq("id", community_id)
        .single();

      if (!existingCommunity || existingCommunity.created_by !== userId) {
        return new Response(
          JSON.stringify({ error: "Not authorized to delete this community" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: deleteError } = await supabase
        .from("communities")
        .delete()
        .eq("id", community_id);

      if (deleteError) {
        console.error("Delete community error:", deleteError);
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

    // JOIN community
    if (action === "join") {
      if (!community_id) {
        return new Response(
          JSON.stringify({ error: "Community ID is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: joinError } = await supabase
        .from("community_members")
        .insert({
          community_id,
          user_id: userId,
          role: "member",
        });

      if (joinError) {
        console.error("Join community error:", joinError);
        return new Response(
          JSON.stringify({ error: joinError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // LEAVE community
    if (action === "leave") {
      if (!community_id) {
        return new Response(
          JSON.stringify({ error: "Community ID is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: leaveError } = await supabase
        .from("community_members")
        .delete()
        .eq("community_id", community_id)
        .eq("user_id", userId);

      if (leaveError) {
        console.error("Leave community error:", leaveError);
        return new Response(
          JSON.stringify({ error: leaveError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // DELETE discussion
    if (action === "delete_discussion") {
      if (!discussion_id) {
        return new Response(
          JSON.stringify({ error: "Discussion ID is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Fetch discussion to get community_id and user_id
      const { data: discussion, error: fetchError } = await supabase
        .from("community_discussions")
        .select("id, user_id, community_id")
        .eq("id", discussion_id)
        .maybeSingle();

      if (fetchError || !discussion) {
        return new Response(
          JSON.stringify({ error: "Discussion not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if user is the discussion owner
      const isOwner = discussion.user_id === userId;

      // Check if user is community creator (admin)
      let isAdmin = false;
      let hasModeratePermission = false;
      
      if (!isOwner) {
        const { data: community } = await supabase
          .from("communities")
          .select("created_by")
          .eq("id", discussion.community_id)
          .maybeSingle();

        isAdmin = community?.created_by === userId;
        
        // Check if user has moderate_discussions permission
        if (!isAdmin) {
          const { data: permission } = await supabase
            .from("community_permissions")
            .select("id")
            .eq("community_id", discussion.community_id)
            .eq("user_id", userId)
            .eq("permission", "moderate_discussions")
            .maybeSingle();
          
          hasModeratePermission = !!permission;
        }
      }

      if (!isOwner && !isAdmin && !hasModeratePermission) {
        return new Response(
          JSON.stringify({ error: "Not authorized to delete this discussion" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: deleteDiscussionError } = await supabase
        .from("community_discussions")
        .delete()
        .eq("id", discussion_id);

      if (deleteDiscussionError) {
        console.error("Delete discussion error:", deleteDiscussionError);
        return new Response(
          JSON.stringify({ error: deleteDiscussionError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // REMOVE MEMBER (admin only)
    if (action === "remove_member") {
      if (!community_id) {
        return new Response(
          JSON.stringify({ error: "Community ID is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!member_user_id) {
        return new Response(
          JSON.stringify({ error: "Member user ID is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify admin (community creator) or user with manage_members permission
      const { data: communityCheck } = await supabase
        .from("communities")
        .select("created_by")
        .eq("id", community_id)
        .maybeSingle();

      const isCreator = communityCheck?.created_by === userId;
      
      // Check if user has manage_members permission
      let hasManagePermission = false;
      if (!isCreator) {
        const { data: permissionCheck } = await supabase
          .from("community_permissions")
          .select("id")
          .eq("community_id", community_id)
          .eq("user_id", userId)
          .eq("permission", "manage_members")
          .maybeSingle();
        
        hasManagePermission = !!permissionCheck;
      }

      if (!isCreator && !hasManagePermission) {
        return new Response(
          JSON.stringify({ error: "Only community admins or members with manage permission can remove members" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Prevent removing the community creator
      if (member_user_id === communityCheck?.created_by) {
        return new Response(
          JSON.stringify({ error: "Cannot remove the community creator" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Prevent admin from removing themselves
      if (member_user_id === userId) {
        return new Response(
          JSON.stringify({ error: "Cannot remove yourself from your own community" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Remove the member
      const { error: removeError } = await supabase
        .from("community_members")
        .delete()
        .eq("community_id", community_id)
        .eq("user_id", member_user_id);

      if (removeError) {
        console.error("Remove member error:", removeError);
        return new Response(
          JSON.stringify({ error: removeError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GRANT PERMISSION (creator only)
    if (action === "grant_permission") {
      if (!community_id || !target_user_id || !permission) {
        return new Response(
          JSON.stringify({ error: "Community ID, target user ID, and permission are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate permission type
      const validPermissions = ['edit_community', 'create_polls', 'moderate_discussions', 'manage_members'];
      if (!validPermissions.includes(permission)) {
        return new Response(
          JSON.stringify({ error: "Invalid permission type" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify user is community creator
      const { data: communityData } = await supabase
        .from("communities")
        .select("created_by")
        .eq("id", community_id)
        .maybeSingle();

      if (!communityData || communityData.created_by !== userId) {
        return new Response(
          JSON.stringify({ error: "Only community creators can manage permissions" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if user is a member
      const { data: memberCheck } = await supabase
        .from("community_members")
        .select("id")
        .eq("community_id", community_id)
        .eq("user_id", target_user_id)
        .maybeSingle();

      if (!memberCheck) {
        return new Response(
          JSON.stringify({ error: "User is not a member of this community" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if permission already exists
      const { data: existingPermission } = await supabase
        .from("community_permissions")
        .select("id")
        .eq("community_id", community_id)
        .eq("user_id", target_user_id)
        .eq("permission", permission)
        .maybeSingle();

      if (existingPermission) {
        return new Response(
          JSON.stringify({ success: true, message: "Permission already granted" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Grant permission
      const { error: grantError } = await supabase
        .from("community_permissions")
        .insert({
          community_id,
          user_id: target_user_id,
          permission,
          granted_by: userId,
        });

      if (grantError) {
        console.error("Grant permission error:", grantError);
        return new Response(
          JSON.stringify({ error: grantError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // REVOKE PERMISSION (creator only)
    if (action === "revoke_permission") {
      if (!community_id || !target_user_id || !permission) {
        return new Response(
          JSON.stringify({ error: "Community ID, target user ID, and permission are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate permission type
      const validPermissions = ['edit_community', 'create_polls', 'moderate_discussions', 'manage_members'];
      if (!validPermissions.includes(permission)) {
        return new Response(
          JSON.stringify({ error: "Invalid permission type" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify user is community creator
      const { data: communityData } = await supabase
        .from("communities")
        .select("created_by")
        .eq("id", community_id)
        .maybeSingle();

      if (!communityData || communityData.created_by !== userId) {
        return new Response(
          JSON.stringify({ error: "Only community creators can manage permissions" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Revoke permission
      const { error: revokeError } = await supabase
        .from("community_permissions")
        .delete()
        .eq("community_id", community_id)
        .eq("user_id", target_user_id)
        .eq("permission", permission);

      if (revokeError) {
        console.error("Revoke permission error:", revokeError);
        return new Response(
          JSON.stringify({ error: revokeError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
