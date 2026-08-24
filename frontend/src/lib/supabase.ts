import type { SupabaseClient } from "@supabase/supabase-js";

// Remote history remains deliberately disabled until the application has an
// authenticated, owner-scoped persistence design. The previous anonymous
// schema exposed a shared writable archive to every browser holding the anon
// key. Local history is the production storage contract in the meantime.
export const supabase: SupabaseClient | null = null;
