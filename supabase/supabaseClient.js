// supabase/supabaseClient.js
// ES MODULE – must be imported by a script with type="module"

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://jszfngwewbpregrwapzo.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzemZuZ3dld2JwcmVncndhcHpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2MDM4ODcsImV4cCI6MjA4NDE3OTg4N30.upKFexugyu5ELBpP9wy6qTgfZwgOi_Z8E2zE-GRFeaU";

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

// Debug (safe)
console.log("✅ Supabase client initialized");
window.supabase = supabase;
