// ============================================
// js/supabase.js — Supabase client config
// REPLACE the two values below with your own
// from: Supabase Dashboard → Project Settings → API
// ============================================

const SUPABASE_URL = "https://jstfweffhqcbbsjbwaxj.supabase.co"       // e.g. https://xyzabc.supabase.co
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzdGZ3ZWZmaHFjYmJzamJ3YXhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczOTU2NzIsImV4cCI6MjA5Mjk3MTY3Mn0.ON2WCQpq90m_8QRYD6EvKumz4uRuFpXVe6CqQZA6Kbs"  // long string starting with "eyJ..."

const { createClient } = supabase
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)