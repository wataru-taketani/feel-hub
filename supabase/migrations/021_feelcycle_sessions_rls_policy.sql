-- Add RLS policies for feelcycle_sessions (RLS is already enabled but no policies exist)
-- Users can only access their own session rows

CREATE POLICY "Users can read own session" ON public.feelcycle_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own session" ON public.feelcycle_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own session" ON public.feelcycle_sessions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own session" ON public.feelcycle_sessions
  FOR DELETE USING (auth.uid() = user_id);
