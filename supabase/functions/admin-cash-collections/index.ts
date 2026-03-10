import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

async function validateAuth(req: Request, supabase: any) {
  // Try admin token first
  const adminToken = req.headers.get("x-admin-token");
  if (adminToken) {
    try {
      const [payload] = adminToken.split(".");
      const decoded = JSON.parse(atob(payload));
      if (!decoded.exp || decoded.exp <= Date.now()) return null;
      if (!decoded.admin_id || !decoded.division_id) return null;
      return {
        adminId: decoded.admin_id,
        divisionId: decoded.division_id,
        adminName: decoded.full_name || "Admin",
        isReadOnly: decoded.is_read_only || false,
        isSuperAdmin: false,
      };
    } catch {
      // fall through to JWT check
    }
  }

  // Try Supabase JWT for super admins
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const token = authHeader.replace("Bearer ", "");
      const { data: userData, error } = await supabase.auth.getUser(token);
      if (error || !userData?.user) return null;

      const userId = userData.user.id;

      // Check if user is super_admin
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "super_admin")
        .maybeSingle();

      if (!roleData) return null;

      // Get profile name
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", userId)
        .maybeSingle();

      return {
        adminId: userId,
        divisionId: null, // super admin can access any division
        adminName: profile?.full_name || userData.user.email || "Super Admin",
        isReadOnly: false,
        isSuperAdmin: true,
      };
    } catch {
      return null;
    }
  }

  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const admin = await validateAuth(req, supabase);
    if (!admin) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // SEARCH: Find members/registrations by mobile number
    if (req.method === "GET" && action === "search_mobile") {
      const mobile = url.searchParams.get("mobile");
      if (!mobile || mobile.length < 3) {
        return new Response(JSON.stringify({ results: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Search members
      const { data: members } = await supabase
        .from("members")
        .select("id, full_name, phone, division_id, panchayath_id, panchayaths(name)")
        .ilike("phone", `%${mobile}%`)
        .limit(20);

      // Search program registrations by phone in answers (server-side JSONB filtering)
      const { data: matchedRegs } = await supabase
        .from("program_registrations")
        .select("id, answers, program_id, programs(name, division_id)")
        .or(`answers->_fixed->>mobile.ilike.%${mobile}%,answers->_fixed->>phone.ilike.%${mobile}%,answers->>phone.ilike.%${mobile}%,answers->>mobile.ilike.%${mobile}%,answers->>contact.ilike.%${mobile}%`)
        .limit(20);

      const results: any[] = [];

      // Add members
      (members || []).forEach((m: any) => {
        results.push({
          type: "member",
          id: m.id,
          name: m.full_name,
          mobile: m.phone,
          division_id: m.division_id,
          panchayath_id: m.panchayath_id,
          panchayath_name: m.panchayaths?.name || null,
        });
      });

      // Add registrations
      matchedRegs?.forEach((r: any) => {
        const answers = r.answers as Record<string, any>;
        const fixed = answers?._fixed as Record<string, string> | undefined;
        results.push({
          type: "registration",
          id: r.id,
          name: fixed?.name || answers?.full_name || answers?.name || "Unknown",
          mobile: fixed?.mobile || fixed?.phone || answers?.phone || answers?.mobile || answers?.contact || "",
          division_id: r.programs?.division_id || null,
          panchayath_id: fixed?.panchayath_id || null,
          panchayath_name: fixed?.panchayath_name || answers?.panchayath || null,
          program_name: r.programs?.name || null,
        });
      });

      return new Response(JSON.stringify({ results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET: Fetch collections for a division
    if (req.method === "GET" && action === "list") {
      const divisionId = url.searchParams.get("division_id") || admin.divisionId;
      const status = url.searchParams.get("status");

      let query = supabase
        .from("cash_collections")
        .select("*, divisions(name), panchayaths(name)")
        .eq("division_id", divisionId)
        .order("created_at", { ascending: false });

      if (status) {
        query = query.eq("status", status);
      }

      const { data, error } = await query;

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ collections: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET: Collection report/summary
    if (req.method === "GET" && action === "report") {
      const divisionId = url.searchParams.get("division_id") || admin.divisionId;

      const { data, error } = await supabase
        .from("cash_collections")
        .select("*")
        .eq("division_id", divisionId)
        .order("created_at", { ascending: false });

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const collections = data || [];
      const totalCollected = collections.reduce((sum: number, c: any) => sum + Number(c.amount), 0);
      const pendingAmount = collections.filter((c: any) => c.status === "pending").reduce((sum: number, c: any) => sum + Number(c.amount), 0);
      const verifiedAmount = collections.filter((c: any) => c.status === "verified").reduce((sum: number, c: any) => sum + Number(c.amount), 0);
      const submittedAmount = collections.filter((c: any) => c.status === "submitted").reduce((sum: number, c: any) => sum + Number(c.amount), 0);

      return new Response(JSON.stringify({
        report: {
          totalCollected,
          pendingAmount,
          verifiedAmount,
          submittedAmount,
          totalEntries: collections.length,
          pendingCount: collections.filter((c: any) => c.status === "pending").length,
          verifiedCount: collections.filter((c: any) => c.status === "verified").length,
          submittedCount: collections.filter((c: any) => c.status === "submitted").length,
        },
        collections,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST: Create new collection
    if (req.method === "POST") {
      if (admin.isReadOnly) {
        return new Response(JSON.stringify({ error: "Read-only admins cannot create collections" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const body = await req.json();
      const { person_name, mobile, division_id, panchayath_id, panchayath_name, member_id, amount, notes } = body;

      if (!person_name || !mobile || !amount) {
        return new Response(JSON.stringify({ error: "person_name, mobile, and amount are required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await supabase
        .from("cash_collections")
        .insert({
          person_name,
          mobile,
          division_id: division_id || admin.divisionId,
          panchayath_id: panchayath_id || null,
          panchayath_name: panchayath_name || null,
          member_id: member_id || null,
          amount: Number(amount),
          notes: notes || null,
          collected_by: admin.adminId,
          collected_by_name: admin.adminName,
        })
        .select()
        .single();

      if (error) {
        console.error("Insert error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, collection: data }), {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET: List ALL collections across divisions (super admin only)
    if (req.method === "GET" && action === "list_all") {
      if (!admin.isSuperAdmin) {
        return new Response(JSON.stringify({ error: "Super admin only" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const status = url.searchParams.get("status");
      let query = supabase
        .from("cash_collections")
        .select("*, divisions(name), panchayaths(name)")
        .order("created_at", { ascending: false })
        .limit(500);

      if (status) query = query.eq("status", status);

      const { data, error } = await query;
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ collections: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET: Report across ALL divisions (super admin only)
    if (req.method === "GET" && action === "report_all") {
      if (!admin.isSuperAdmin) {
        return new Response(JSON.stringify({ error: "Super admin only" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await supabase
        .from("cash_collections")
        .select("*, divisions(name)")
        .order("created_at", { ascending: false });

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const collections = data || [];
      const totalCollected = collections.reduce((sum: number, c: any) => sum + Number(c.amount), 0);
      const pendingAmount = collections.filter((c: any) => c.status === "pending").reduce((sum: number, c: any) => sum + Number(c.amount), 0);
      const verifiedAmount = collections.filter((c: any) => c.status === "verified").reduce((sum: number, c: any) => sum + Number(c.amount), 0);
      const submittedAmount = collections.filter((c: any) => c.status === "submitted").reduce((sum: number, c: any) => sum + Number(c.amount), 0);

      return new Response(JSON.stringify({
        report: {
          totalCollected,
          pendingAmount,
          verifiedAmount,
          submittedAmount,
          totalEntries: collections.length,
          pendingCount: collections.filter((c: any) => c.status === "pending").length,
          verifiedCount: collections.filter((c: any) => c.status === "verified").length,
          submittedCount: collections.filter((c: any) => c.status === "submitted").length,
        },
        collections,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // PUT: Verify, Submit, or Edit collections
    if (req.method === "PUT") {
      const body = await req.json();
      const { collection_id, collection_ids, action: putAction } = body;

      if (putAction === "edit") {
        if (!admin.isSuperAdmin) {
          return new Response(JSON.stringify({ error: "Only super admin can edit collections" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (!collection_id) {
          return new Response(JSON.stringify({ error: "collection_id required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const updateData: Record<string, any> = {};
        if (body.person_name !== undefined) updateData.person_name = body.person_name;
        if (body.mobile !== undefined) updateData.mobile = body.mobile;
        if (body.amount !== undefined) updateData.amount = Number(body.amount);
        if (body.notes !== undefined) updateData.notes = body.notes;
        if (body.status !== undefined) updateData.status = body.status;
        if (body.panchayath_name !== undefined) updateData.panchayath_name = body.panchayath_name;
        updateData.updated_at = new Date().toISOString();

        const { data, error } = await supabase
          .from("cash_collections")
          .update(updateData)
          .eq("id", collection_id)
          .select()
          .single();

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ success: true, collection: data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (putAction === "verify") {
        if (admin.isReadOnly) {
          return new Response(JSON.stringify({ error: "Read-only admins cannot verify" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const id = collection_id;
        if (!id) {
          return new Response(JSON.stringify({ error: "collection_id required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { error } = await supabase
          .from("cash_collections")
          .update({
            status: "verified",
            verified_by: admin.adminId,
            verified_by_name: admin.adminName,
            verified_at: new Date().toISOString(),
          })
          .eq("id", id)
          .eq("status", "pending");

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (putAction === "submit") {
        if (admin.isReadOnly) {
          return new Response(JSON.stringify({ error: "Read-only admins cannot submit" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const ids = collection_ids || (collection_id ? [collection_id] : []);
        if (ids.length === 0) {
          return new Response(JSON.stringify({ error: "collection_id(s) required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { error } = await supabase
          .from("cash_collections")
          .update({
            status: "submitted",
            submitted_by: admin.adminId,
            submitted_by_name: admin.adminName,
            submitted_at: new Date().toISOString(),
          })
          .in("id", ids)
          .eq("status", "verified");

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // DELETE: Delete a collection (super admin only)
    if (req.method === "DELETE") {
      if (!admin.isSuperAdmin) {
        return new Response(JSON.stringify({ error: "Only super admin can delete collections" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const collectionId = url.searchParams.get("collection_id");
      if (!collectionId) {
        return new Response(JSON.stringify({ error: "collection_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await supabase
        .from("cash_collections")
        .delete()
        .eq("id", collectionId);

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
