-- IMPORTANT: Run these migrations in your Supabase dashboard SQL editor
-- These migrations add booking hierarchy checks and password management features

-- ============================================
-- 1. BOOKING HIERARCHY CHECKS
-- ============================================

-- Function to check if parent system is booked
CREATE OR REPLACE FUNCTION is_parent_system_booked(
  p_subsystem_id UUID,
  p_start TIMESTAMP WITH TIME ZONE,
  p_end TIMESTAMP WITH TIME ZONE
)
RETURNS BOOLEAN AS $$
DECLARE
  v_system_id UUID;
BEGIN
  -- Get parent system ID
  SELECT system_id INTO v_system_id 
  FROM subsystems 
  WHERE id = p_subsystem_id;
  
  -- Check if parent system has any active bookings in the time range
  RETURN EXISTS (
    SELECT 1 FROM system_bookings
    WHERE system_id = v_system_id
    AND status = 'active'
    AND (
      (booking_start <= p_start AND booking_end > p_start) OR
      (booking_start < p_end AND booking_end >= p_end) OR
      (booking_start >= p_start AND booking_end <= p_end)
    )
  );
END;
$$ LANGUAGE plpgsql;

-- Function to check if all subsystems are free for a system booking
CREATE OR REPLACE FUNCTION are_all_subsystems_free(
  p_system_id UUID,
  p_start TIMESTAMP WITH TIME ZONE,
  p_end TIMESTAMP WITH TIME ZONE
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if any subsystem has active bookings in the time range
  RETURN NOT EXISTS (
    SELECT 1 FROM subsystem_bookings sb
    JOIN subsystems s ON sb.subsystem_id = s.id
    WHERE s.system_id = p_system_id
    AND sb.status = 'active'
    AND (
      (sb.booking_start <= p_start AND sb.booking_end > p_start) OR
      (sb.booking_start < p_end AND sb.booking_end >= p_end) OR
      (sb.booking_start >= p_start AND sb.booking_end <= p_end)
    )
  );
END;
$$ LANGUAGE plpgsql;

-- Enhanced trigger for subsystem booking validation
CREATE OR REPLACE FUNCTION validate_subsystem_booking()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if parent system is booked
  IF is_parent_system_booked(NEW.subsystem_id, NEW.booking_start, NEW.booking_end) THEN
    -- Allow only if user is admin
    IF NOT public.is_admin() THEN
      RAISE EXCEPTION 'Cannot book subsystem: Parent system is already booked for this time period';
    END IF;
  END IF;
  
  -- Check for subsystem conflicts (existing check)
  IF check_subsystem_booking_conflicts(NEW.subsystem_id, NEW.booking_start, NEW.booking_end, NEW.id) THEN
    -- Allow admin override
    IF NOT public.is_admin() THEN
      RAISE EXCEPTION 'Booking conflicts with existing reservation';
    ELSE
      -- Admin can override - cancel conflicting bookings
      UPDATE subsystem_bookings 
      SET status = 'cancelled',
          updated_at = NOW()
      WHERE subsystem_id = NEW.subsystem_id
      AND status = 'active'
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
      AND (
        (booking_start <= NEW.booking_start AND booking_end > NEW.booking_start) OR
        (booking_start < NEW.booking_end AND booking_end >= NEW.booking_end) OR
        (booking_start >= NEW.booking_start AND booking_end <= NEW.booking_end)
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Enhanced trigger for system booking validation
CREATE OR REPLACE FUNCTION validate_system_booking()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if all subsystems are free
  IF NOT are_all_subsystems_free(NEW.system_id, NEW.booking_start, NEW.booking_end) THEN
    -- Allow only if user is admin
    IF NOT public.is_admin() THEN
      RAISE EXCEPTION 'Cannot book system: One or more subsystems are already booked for this time period';
    ELSE
      -- Admin can override - cancel conflicting subsystem bookings
      UPDATE subsystem_bookings 
      SET status = 'cancelled',
          updated_at = NOW()
      WHERE subsystem_id IN (
        SELECT id FROM subsystems WHERE system_id = NEW.system_id
      )
      AND status = 'active'
      AND (
        (booking_start <= NEW.booking_start AND booking_end > NEW.booking_start) OR
        (booking_start < NEW.booking_end AND booking_end >= NEW.booking_end) OR
        (booking_start >= NEW.booking_start AND booking_end <= NEW.booking_end)
      );
    END IF;
  END IF;
  
  -- Check for system conflicts (existing check)
  IF check_booking_conflicts(NEW.system_id, NEW.booking_start, NEW.booking_end, NEW.id) THEN
    -- Allow admin override
    IF NOT public.is_admin() THEN
      RAISE EXCEPTION 'Booking conflicts with existing reservation';
    ELSE
      -- Admin can override - cancel conflicting bookings
      UPDATE system_bookings 
      SET status = 'cancelled',
          updated_at = NOW()
      WHERE system_id = NEW.system_id
      AND status = 'active'
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
      AND (
        (booking_start <= NEW.booking_start AND booking_end > NEW.booking_start) OR
        (booking_start < NEW.booking_end AND booking_end >= NEW.booking_end) OR
        (booking_start >= NEW.booking_start AND booking_end <= NEW.booking_end)
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers
DROP TRIGGER IF EXISTS prevent_system_booking_overlap ON system_bookings;
DROP TRIGGER IF EXISTS prevent_subsystem_booking_overlap ON subsystem_bookings;

-- Create new enhanced triggers
CREATE TRIGGER validate_system_booking_trigger
BEFORE INSERT OR UPDATE ON system_bookings
FOR EACH ROW EXECUTE FUNCTION validate_system_booking();

CREATE TRIGGER validate_subsystem_booking_trigger
BEFORE INSERT OR UPDATE ON subsystem_bookings
FOR EACH ROW EXECUTE FUNCTION validate_subsystem_booking();

-- Function to automatically cancel subsystem bookings when parent system is booked
CREATE OR REPLACE FUNCTION handle_system_booking_cascade()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'active' THEN
    -- When a system is booked, cancel all subsystem bookings in that time range (unless by admin)
    IF NOT public.is_admin() THEN
      UPDATE subsystem_bookings 
      SET status = 'cancelled',
          updated_at = NOW()
      WHERE subsystem_id IN (
        SELECT id FROM subsystems WHERE system_id = NEW.system_id
      )
      AND status = 'active'
      AND user_id != NEW.user_id
      AND (
        (booking_start <= NEW.booking_start AND booking_end > NEW.booking_start) OR
        (booking_start < NEW.booking_end AND booking_end >= NEW.booking_end) OR
        (booking_start >= NEW.booking_start AND booking_end <= NEW.booking_end)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER system_booking_cascade_trigger
AFTER INSERT OR UPDATE ON system_bookings
FOR EACH ROW EXECUTE FUNCTION handle_system_booking_cascade();

-- ============================================
-- 2. PASSWORD MANAGEMENT
-- ============================================

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