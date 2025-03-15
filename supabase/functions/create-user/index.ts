
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Verify the request is from an admin or moderator
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if the user is admin or moderator
    const { data: userData, error: userError } = await supabaseClient
      .from("users")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (userError || !userData) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (userData.role !== "Admin" && userData.role !== "Moderator") {
      return new Response(
        JSON.stringify({ error: "Insufficient permissions" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse the request
    const { email, password, name, mobile_number, tsa_id, role } = await req.json();

    // Validate input
    if (!email || !password || !name || !role) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if moderator is trying to create an admin
    if (userData.role === "Moderator" && role === "Admin") {
      return new Response(
        JSON.stringify({ error: "Moderators cannot create admin accounts" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create the user
    const { data: authData, error: signUpError } = await supabaseClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });

    if (signUpError) {
      return new Response(
        JSON.stringify({ error: signUpError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // The user record in our custom table is created by the database trigger
    // But we need to update some additional fields
    if (mobile_number || tsa_id) {
      const { error: updateError } = await supabaseClient
        .from("users")
        .update({
          mobile_number,
          tsa_id,
          role,
          created_by: user.id,
        })
        .eq("user_id", authData.user.id);

      if (updateError) {
        console.error("Error updating user details:", updateError);
        // We don't want to fail the request if this part fails
      }
    }

    // Log the audit event
    await supabaseClient.from("audit_log").insert({
      user_id: user.id,
      action_type: "CREATE_USER",
      description: `Created user ${email} with role ${role}`,
      target_id: authData.user.id,
      target_type: "USER",
    });

    return new Response(
      JSON.stringify({ message: "User created successfully", user: authData.user }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error.message);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
