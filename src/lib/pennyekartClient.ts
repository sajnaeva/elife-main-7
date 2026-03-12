import { createClient } from '@supabase/supabase-js';

const PENNYEKART_URL = "https://xxlocaexuoowxdzupjcs.supabase.co";
const PENNYEKART_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4bG9jYWV4dW9vd3hkenVwamNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwNDk4ODQsImV4cCI6MjA4NjYyNTg4NH0.O37LZxDIvXadXEAgeuQotmO3Pqh0cWKCM5h05WmAOwE";

export const pennyekartClient = createClient(PENNYEKART_URL, PENNYEKART_ANON_KEY);
