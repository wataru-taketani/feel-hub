-- Enable RLS on studios table (master data: public read, service_role write)
ALTER TABLE public.studios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access" ON public.studios
  FOR SELECT USING (true);
