import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { user_id, name, description, category, location, logo_url, cover_image_url, website_url, instagram_link, youtube_link } = await req.json();

    console.log("Creating business for user:", user_id);

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: "User ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!name) {
      return new Response(
        JSON.stringify({ error: "Business name is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user exists in profiles
    const { data: userProfile, error: userError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user_id)
      .maybeSingle();

    if (!userProfile) {
      console.error("User not found:", user_id);
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create the business with pending approval status
    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .insert({
        owner_id: user_id,
        name,
        description: description || null,
        category: category || 'other',
        location: location || null,
        logo_url: logo_url || null,
        cover_image_url: cover_image_url || null,
        website_url: website_url || null,
        instagram_link: instagram_link || null,
        youtube_link: youtube_link || null,
        approval_status: 'pending', // Require admin approval
      })
      .select()
      .single();

    if (businessError) {
      console.error("Business creation error:", businessError);
      return new Response(
        JSON.stringify({ error: "Failed to create business: " + businessError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Business created successfully:", business.id);

    return new Response(
      JSON.stringify({ success: true, business }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Create business error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
