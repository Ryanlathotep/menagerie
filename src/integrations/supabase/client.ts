import { createClient } from '@supabase/supabase-js';

// Use Vite env vars when available (preview, local dev, Lovable hosting).
// Fall back to hardcoded values so the static itch.io build still works
// when env vars aren't injected at build time.
const supabaseUrl =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ||
  'https://ijhisspxewnmriuewaxs.supabase.co';

const supabaseAnonKey =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ||
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqaGlzc3B4ZXdubXJpdWV3YXhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzODE3MDMsImV4cCI6MjA4NDk1NzcwM30.X9LQKEOkhckY5d3P7HWvxvvqHKctQU9CuegZgW85_zI';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
