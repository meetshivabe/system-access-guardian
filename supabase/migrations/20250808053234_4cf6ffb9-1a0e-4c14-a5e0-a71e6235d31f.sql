-- Allow authenticated users to update lock status on systems
CREATE POLICY "Users can update system lock status" 
ON public.systems 
FOR UPDATE 
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow authenticated users to update lock status on subsystems  
CREATE POLICY "Users can update subsystem lock status" 
ON public.subsystems 
FOR UPDATE 
TO authenticated
USING (true)
WITH CHECK (true);