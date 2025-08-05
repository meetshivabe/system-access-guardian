-- Create the first admin user manually
-- This is just an example - you'll need to sign up through the app first
-- Then run this to make that user an admin

-- Note: Replace 'your-admin-email@example.com' with your actual email
-- First, you need to sign up through the app, then find your user ID and run:
-- INSERT INTO public.user_roles (user_id, role) VALUES ('your-user-id-here', 'admin');

-- For now, let's create a function to easily promote users to admin
CREATE OR REPLACE FUNCTION public.make_user_admin(user_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_user_id UUID;
BEGIN
  -- Find user by email
  SELECT id INTO target_user_id 
  FROM auth.users 
  WHERE email = user_email;
  
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'User with email % not found', user_email;
  END IF;
  
  -- Insert admin role if not exists
  INSERT INTO public.user_roles (user_id, role) 
  VALUES (target_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN TRUE;
END;
$$;