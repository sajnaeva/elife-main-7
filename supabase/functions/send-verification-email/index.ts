import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerificationRequest {
  user_id: string;
  email: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const resend = new Resend(resendApiKey);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { user_id, email }: VerificationRequest = await req.json();

    if (!user_id || !email) {
      return new Response(
        JSON.stringify({ error: "User ID and email are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Generate a verification token
    const verificationToken = crypto.randomUUID();

    // Store the verification token in the profiles table directly
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ 
        email, 
        email_verified: false,
        email_verification_token: verificationToken,
        email_verification_sent_at: new Date().toISOString()
      })
      .eq('id', user_id);

    if (updateError) {
      console.error("Profile update error:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to send verification" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Generate verification link
    const origin = req.headers.get('origin') || 'https://id-preview--0db7b0a9-92c3-4762-8061-8aee119fad8f.lovable.app';
    const verificationLink = `${origin}/verify-email?token=${verificationToken}`;

    console.log("Sending verification email to:", email);
    console.log("Verification link:", verificationLink);

    // Send the verification email using Resend
    const emailResponse = await resend.emails.send({
      from: "Siragugal <onboarding@resend.dev>",
      to: [email],
      subject: "Verify your email address - Siragugal",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
          <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <div style="background-color: #ffffff; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #1a1a1a; font-size: 24px; margin: 0;">Welcome to Siragugal!</h1>
              </div>
              
              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                Thank you for signing up! Please verify your email address by clicking the button below:
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${verificationLink}" 
                   style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                  Verify Email Address
                </a>
              </div>
              
              <p style="color: #666666; font-size: 14px; line-height: 1.6; margin-top: 30px;">
                Or copy and paste this link into your browser:
              </p>
              <p style="color: #2563eb; font-size: 14px; word-break: break-all;">
                ${verificationLink}
              </p>
              
              <hr style="border: none; border-top: 1px solid #eeeeee; margin: 30px 0;">
              
              <p style="color: #999999; font-size: 12px; text-align: center;">
                If you didn't create an account with Siragugal, you can safely ignore this email.
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Verification email sent successfully"
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in send-verification-email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
