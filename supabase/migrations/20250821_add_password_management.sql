-- Function for admin to reset user password without knowing old password
CREATE OR REPLACE FUNCTION admin_reset_user_password(
  target_user_id UUID,
  new_password TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if the caller is an admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only administrators can reset user passwords';
  END IF;

  -- Check if target user exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = target_user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Validate password length
  IF LENGTH(new_password) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters long';
  END IF;

  -- Update the user's password in auth.users
  UPDATE auth.users 
  SET 
    encrypted_password = crypt(new_password, gen_salt('bf')),
    updated_at = NOW()
  WHERE id = target_user_id;

  -- Log the password reset action (optional, for audit trail)
  INSERT INTO public.audit_logs (
    action,
    user_id,
    target_id,
    details,
    created_at
  ) VALUES (
    'password_reset',
    auth.uid(),
    target_user_id,
    jsonb_build_object('reset_by_admin', true),
    NOW()
  ) ON CONFLICT DO NOTHING; -- Ignore if audit_logs table doesn't exist
END;
$$;

-- Create audit logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  action TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  target_id UUID,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view audit logs" 
ON public.audit_logs 
FOR SELECT 
USING (public.is_admin());

-- Grant execute permission on the function to authenticated users
GRANT EXECUTE ON FUNCTION admin_reset_user_password TO authenticated;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);