-- Allow authenticated users (builders and managers) to create materials
CREATE POLICY "Authenticated users can create materials" ON "materials" FOR INSERT TO authenticated WITH CHECK (true);