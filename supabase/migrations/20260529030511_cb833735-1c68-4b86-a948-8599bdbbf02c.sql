-- Allow authenticated users to update lanes (admin editing).
CREATE POLICY "lanes_authenticated_update"
ON public.lanes
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

GRANT UPDATE ON public.lanes TO authenticated;