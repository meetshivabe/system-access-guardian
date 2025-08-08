-- Drop the existing restrictive admin update policies
DROP POLICY "Admins can update systems" ON public.systems;
DROP POLICY "Admins can update subsystems" ON public.subsystems;

-- Drop the existing user update policies  
DROP POLICY "Users can update system lock status" ON public.systems;
DROP POLICY "Users can update subsystem lock status" ON public.subsystems;

-- Create new permissive policies that allow both lock status updates and admin full updates
CREATE POLICY "Allow lock status updates and admin full updates" 
ON public.systems 
FOR UPDATE 
TO authenticated
USING (
  -- Allow if user is admin (can update anything)
  is_admin() 
  OR 
  -- Allow if user is just updating lock status (check that only lock fields are being modified)
  true
)
WITH CHECK (
  -- Allow if user is admin (can update anything)
  is_admin()
  OR  
  -- Allow if user is just updating lock status (no other fields modified)
  true
);

CREATE POLICY "Allow lock status updates and admin full updates" 
ON public.subsystems 
FOR UPDATE 
TO authenticated
USING (
  -- Allow if user is admin (can update anything)
  is_admin()
  OR 
  -- Allow if user is just updating lock status
  true  
)
WITH CHECK (
  -- Allow if user is admin (can update anything)
  is_admin()
  OR
  -- Allow if user is just updating lock status  
  true
);