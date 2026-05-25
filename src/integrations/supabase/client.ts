import { createClient } from '@supabase/supabase-js';

// Hardcoded credentials to support itch.io static hosting
const supabaseUrl = "https://supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqaGlzc3B4ZXdubXJpdWV3YXhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzODE3MDMsImV4cCI6MjA4NDk1NzcwM30.X9LQKEOkhckY5d3P7HWvxvvqHKctQU9CuegZgW85_zI";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
