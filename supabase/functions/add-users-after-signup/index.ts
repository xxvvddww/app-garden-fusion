
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get the authorization header from the request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract the token
    const token = authHeader.replace("Bearer ", "");
    
    // Get the user from the token
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Got user from token:", user.id);

    // Check if this user already exists in the users table
    const { data: existingUser, error: checkError } = await supabaseClient
      .from("users")
      .select("*")
      .eq("user_id", user.id)
      .single();
      
    if (checkError && checkError.code !== "PGRST116") {
      console.error("Error checking for existing user:", checkError);
    }
    
    if (existingUser) {
      console.log("User already exists in users table");
      return new Response(
        JSON.stringify({ message: "User already exists in users table", user: existingUser }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse the request body to get additional user info
    const requestData = await req.json();
    console.log("Request data:", requestData);

    // Insert the user into the users table with the provided metadata and default values
    const { data: insertedUser, error: insertError } = await supabaseClient
      .from("users")
      .insert({
        user_id: user.id,
        email: user.email,
        name: user.user_metadata.name || requestData.name,
        mobile_number: user.user_metadata.mobile_number || requestData.mobileNumber,
        tsa_id: user.user_metadata.tsa_id || requestData.tsaId,
        role: "User",
        status: "Pending"
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error inserting user:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to insert user into users table", details: insertError }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Successfully created user record:", insertedUser);

    return new Response(
      JSON.stringify({ message: "User inserted successfully", user: insertedUser }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Server error:", error.message);
    return new Response(
      JSON.stringify({ error: "Server error", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
