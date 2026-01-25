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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const sessionToken = req.headers.get("x-session-token");
    let userId: string | null = null;

    // Validate session if provided
    if (sessionToken) {
      const { data: sessionUserId } = await supabase.rpc("validate_session", {
        p_session_token: sessionToken,
      });
      userId = sessionUserId;
    }

    const body = await req.json();
    const { action } = body;

    let result;

    switch (action) {
      case "list": {
        // Auto-close expired jobs first
        await supabase
          .from("jobs")
          .update({ status: "closed", updated_at: new Date().toISOString() })
          .eq("status", "open")
          .lt("expires_at", new Date().toISOString())
          .not("expires_at", "is", null);

        // Fetch all jobs with creator profiles
        const { data: allJobs, error } = await supabase
          .from("jobs")
          .select(`
            *,
            profiles:creator_id (id, full_name, username, avatar_url)
          `)
          .order("created_at", { ascending: false });

        if (error) throw error;

        // Filter jobs based on visibility rules:
        // - approved + open jobs visible to everyone
        // - creator can see their own jobs (any status)
        const filteredJobs = (allJobs || []).filter((job) => {
          // Creator can always see their own jobs
          if (userId && job.creator_id === userId) return true;
          // Everyone can see approved open jobs
          if (job.approval_status === "approved" && job.status === "open") return true;
          return false;
        });

        // Get application counts
        const jobsWithCounts = await Promise.all(
          filteredJobs.map(async (job) => {
            const { count } = await supabase
              .from("job_applications")
              .select("*", { count: "exact", head: true })
              .eq("job_id", job.id);

            let hasApplied = false;
            if (userId) {
              const { data: application } = await supabase
                .from("job_applications")
                .select("id")
                .eq("job_id", job.id)
                .eq("applicant_id", userId)
                .maybeSingle();
              hasApplied = !!application;
            }

            return {
              ...job,
              application_count: count || 0,
              has_applied: hasApplied,
            };
          })
        );

        result = { jobs: jobsWithCounts };
        break;
      }

      case "my_jobs": {
        if (!userId) {
          return new Response(
            JSON.stringify({ error: "Authentication required" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Fetch user's jobs
        const { data, error } = await supabase
          .from("jobs")
          .select(`
            *,
            profiles:creator_id (id, full_name, username, avatar_url)
          `)
          .eq("creator_id", userId)
          .order("created_at", { ascending: false });

        if (error) throw error;

        // Get application counts
        const jobsWithCounts = await Promise.all(
          (data || []).map(async (job) => {
            const { count } = await supabase
              .from("job_applications")
              .select("*", { count: "exact", head: true })
              .eq("job_id", job.id);

            return {
              ...job,
              application_count: count || 0,
            };
          })
        );

        result = { jobs: jobsWithCounts };
        break;
      }

      case "get": {
        const { job_id } = body;
        if (!job_id) {
          return new Response(
            JSON.stringify({ error: "Job ID required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: job, error } = await supabase
          .from("jobs")
          .select(`
            *,
            profiles:creator_id (id, full_name, username, avatar_url)
          `)
          .eq("id", job_id)
          .single();

        if (error) throw error;

        // Check visibility
        const canView = 
          (userId && job.creator_id === userId) ||
          (job.approval_status === "approved" && job.status === "open");

        if (!canView) {
          return new Response(
            JSON.stringify({ error: "Job not found or access denied" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Get application count
        const { count } = await supabase
          .from("job_applications")
          .select("*", { count: "exact", head: true })
          .eq("job_id", job_id);

        // Check if user has applied
        let hasApplied = false;
        if (userId) {
          const { data: application } = await supabase
            .from("job_applications")
            .select("id")
            .eq("job_id", job_id)
            .eq("applicant_id", userId)
            .maybeSingle();
          hasApplied = !!application;
        }

        // Fetch applications if user is creator
        let applications: any[] = [];
        if (userId && job.creator_id === userId) {
          const { data: apps } = await supabase
            .from("job_applications")
            .select(`
              *,
              profiles:applicant_id (id, full_name, username, avatar_url, mobile_number, email)
            `)
            .eq("job_id", job_id)
            .order("created_at", { ascending: false });
          applications = apps || [];
        }

        result = {
          job: {
            ...job,
            application_count: count || 0,
            has_applied: hasApplied,
          },
          applications,
        };
        break;
      }

      case "create": {
        if (!userId) {
          return new Response(
            JSON.stringify({ error: "Authentication required" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { title, description, conditions, location, max_applications, expires_at } = body;

        if (!title?.trim() || !description?.trim()) {
          return new Response(
            JSON.stringify({ error: "Title and description are required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: job, error } = await supabase
          .from("jobs")
          .insert({
            creator_id: userId,
            title: title.trim(),
            description: description.trim(),
            conditions: conditions?.trim() || null,
            location: location?.trim() || null,
            max_applications: max_applications || null,
            expires_at: expires_at || null,
            status: "open",
            approval_status: "pending",
          })
          .select()
          .single();

        if (error) throw error;

        result = { job, message: "Job created! It will be visible after admin approval." };
        break;
      }

      case "update": {
        if (!userId) {
          return new Response(
            JSON.stringify({ error: "Authentication required" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { job_id, ...updates } = body;
        if (!job_id) {
          return new Response(
            JSON.stringify({ error: "Job ID required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Verify ownership
        const { data: existing } = await supabase
          .from("jobs")
          .select("creator_id")
          .eq("id", job_id)
          .single();

        if (!existing || existing.creator_id !== userId) {
          return new Response(
            JSON.stringify({ error: "Not authorized to update this job" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Filter allowed update fields
        const allowedFields = ["title", "description", "conditions", "location", "max_applications", "expires_at", "status"];
        const filteredUpdates: Record<string, any> = {};
        for (const key of allowedFields) {
          if (key in updates) {
            filteredUpdates[key] = updates[key];
          }
        }
        filteredUpdates.updated_at = new Date().toISOString();

        const { error } = await supabase
          .from("jobs")
          .update(filteredUpdates)
          .eq("id", job_id);

        if (error) throw error;

        result = { success: true };
        break;
      }

      case "delete": {
        if (!userId) {
          return new Response(
            JSON.stringify({ error: "Authentication required" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { job_id } = body;
        if (!job_id) {
          return new Response(
            JSON.stringify({ error: "Job ID required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Verify ownership
        const { data: existing } = await supabase
          .from("jobs")
          .select("creator_id")
          .eq("id", job_id)
          .single();

        if (!existing || existing.creator_id !== userId) {
          return new Response(
            JSON.stringify({ error: "Not authorized to delete this job" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Delete applications first
        await supabase.from("job_applications").delete().eq("job_id", job_id);

        // Delete job
        const { error } = await supabase.from("jobs").delete().eq("id", job_id);

        if (error) throw error;

        result = { success: true };
        break;
      }

      case "apply": {
        if (!userId) {
          return new Response(
            JSON.stringify({ error: "Authentication required" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { job_id, message, education_qualification, experience_details } = body;
        if (!job_id) {
          return new Response(
            JSON.stringify({ error: "Job ID required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Check job exists and is open
        const { data: job } = await supabase
          .from("jobs")
          .select("id, status, approval_status, creator_id")
          .eq("id", job_id)
          .single();

        if (!job || job.status !== "open" || job.approval_status !== "approved") {
          return new Response(
            JSON.stringify({ error: "Job is not open for applications" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (job.creator_id === userId) {
          return new Response(
            JSON.stringify({ error: "Cannot apply to your own job" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Check for existing application
        const { data: existing } = await supabase
          .from("job_applications")
          .select("id")
          .eq("job_id", job_id)
          .eq("applicant_id", userId)
          .maybeSingle();

        if (existing) {
          return new Response(
            JSON.stringify({ error: "You have already applied to this job" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { error } = await supabase.from("job_applications").insert({
          job_id,
          applicant_id: userId,
          message: message?.trim() || null,
          education_qualification: education_qualification?.trim() || null,
          experience_details: experience_details?.trim() || null,
        });

        if (error) throw error;

        result = { success: true, message: "Application submitted!" };
        break;
      }

      case "reply": {
        if (!userId) {
          return new Response(
            JSON.stringify({ error: "Authentication required" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { application_id, reply_type } = body;
        if (!application_id) {
          return new Response(
            JSON.stringify({ error: "Application ID required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Get application and verify ownership
        const { data: application } = await supabase
          .from("job_applications")
          .select("id, job_id, jobs:job_id(creator_id)")
          .eq("id", application_id)
          .single();

        if (!application) {
          return new Response(
            JSON.stringify({ error: "Application not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const jobCreatorId = (application.jobs as any)?.creator_id;
        if (jobCreatorId !== userId) {
          return new Response(
            JSON.stringify({ error: "Not authorized to reply to this application" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Fixed reply messages
        const replyMessages: Record<string, string> = {
          contact_soon: "We will contact you soon. Thank you for your interest!",
          shortlisted: "Congratulations! You have been shortlisted. We will contact you for further details.",
          not_selected: "Thank you for applying. Unfortunately, we have decided to move forward with other candidates.",
        };

        const replyMessage = replyMessages[reply_type] || replyMessages.contact_soon;

        const { error } = await supabase
          .from("job_applications")
          .update({
            creator_reply: replyMessage,
            replied_at: new Date().toISOString(),
          })
          .eq("id", application_id);

        if (error) throw error;

        result = { success: true, message: "Reply sent!" };
        break;
      }

      case "get_all_applications": {
        // Admin-only: get all applications for admin panel
        const sessionToken = req.headers.get("x-session-token");
        if (!sessionToken) {
          return new Response(
            JSON.stringify({ error: "Admin authentication required" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Check admin role
        const { data: session } = await supabase
          .from("user_sessions")
          .select("user_id, expires_at, is_active")
          .eq("session_token", sessionToken)
          .eq("is_active", true)
          .gt("expires_at", new Date().toISOString())
          .single();

        if (!session) {
          return new Response(
            JSON.stringify({ error: "Invalid or expired session" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user_id);

        if (!roles || roles.length === 0) {
          return new Response(
            JSON.stringify({ error: "Unauthorized: Admin access required" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Fetch all applications with job and applicant details
        const { data: applications, error: appsError } = await supabase
          .from("job_applications")
          .select(`
            *,
            jobs:job_id (id, title, creator_id, status, approval_status),
            applicant:applicant_id (id, full_name, username, avatar_url, mobile_number, email)
          `)
          .order("created_at", { ascending: false });

        if (appsError) throw appsError;

        result = { applications: applications || [] };
        break;
      }

      case "my_applications": {
        if (!userId) {
          return new Response(
            JSON.stringify({ error: "Authentication required" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Fetch all applications by this user with job details
        const { data: applications, error: appsError } = await supabase
          .from("job_applications")
          .select(`
            *,
            jobs:job_id (
              id, 
              title, 
              description,
              location,
              status, 
              approval_status,
              creator_id,
              created_at,
              profiles:creator_id (id, full_name, username, avatar_url)
            )
          `)
          .eq("applicant_id", userId)
          .order("created_at", { ascending: false });

        if (appsError) throw appsError;

        result = { applications: applications || [] };
        break;
      }

      case "check_business_owner": {
        if (!userId) {
          return new Response(
            JSON.stringify({ error: "Authentication required" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Check if user owns any approved business
        const { data: businesses, error: bizError } = await supabase
          .from("businesses")
          .select("id")
          .eq("owner_id", userId)
          .eq("approval_status", "approved")
          .limit(1);

        if (bizError) throw bizError;

        result = { is_business_owner: (businesses && businesses.length > 0) };
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: "Invalid action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Manage jobs error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
