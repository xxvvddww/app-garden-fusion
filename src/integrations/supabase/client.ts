// This file is automatically generated. Do not edit it directly.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = "https://xkxaoyuxdxamhszltqgx.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhreGFveXV4ZHhhbWhzemx0cWd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIwNTg4NjEsImV4cCI6MjA1NzYzNDg2MX0.easK7cjl-T9o31F1xV804WcFa8oDmaQI6YQLwt__xqc";

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);