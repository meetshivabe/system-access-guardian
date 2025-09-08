-- ========================================
-- FIX ADMIN PERMISSION FOR CANCELLING BOOKINGS
-- Run this SQL in your Supabase SQL Editor
-- ========================================

-- Drop and recreate the is_admin function to work with both user_roles table and profiles.role column
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- First check user_roles table (primary method)
  IF EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  ) THEN
    RETURN TRUE;
  END IF;
  
  -- Fallback to profiles.role column if user_roles doesn't have the entry
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  ) THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Update the cancel booking functions to use the fixed is_admin
DROP FUNCTION IF EXISTS cancel_system_booking(UUID);
CREATE OR REPLACE FUNCTION cancel_system_booking(p_booking_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_is_admin BOOLEAN;
  v_booking RECORD;
BEGIN
  -- Check if user is admin using the updated function
  v_user_is_admin := public.is_admin();
  
  IF NOT v_user_is_admin THEN
    RAISE EXCEPTION 'Only administrators can cancel bookings. Current user admin status: %', v_user_is_admin;
  END IF;
  
  -- Get booking details
  SELECT * INTO v_booking
  FROM system_bookings
  WHERE id = p_booking_id
  AND status = 'active';
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Cancel the booking
  UPDATE system_bookings
  SET status = 'cancelled',
      updated_at = NOW()
  WHERE id = p_booking_id;
  
  -- If booking was active (current time within booking period), unlock the system
  IF v_booking.booking_start <= NOW() AND v_booking.booking_end > NOW() THEN
    UPDATE systems
    SET is_locked = false,
        locked_by = NULL,
        locked_at = NULL,
        booking_start = NULL,
        booking_end = NULL
    WHERE id = v_booking.system_id
    AND locked_by = v_booking.user_id;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP FUNCTION IF EXISTS cancel_subsystem_booking(UUID);
CREATE OR REPLACE FUNCTION cancel_subsystem_booking(p_booking_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_is_admin BOOLEAN;
  v_booking RECORD;
BEGIN
  -- Check if user is admin using the updated function
  v_user_is_admin := public.is_admin();
  
  IF NOT v_user_is_admin THEN
    RAISE EXCEPTION 'Only administrators can cancel bookings. Current user admin status: %', v_user_is_admin;
  END IF;
  
  -- Get booking details
  SELECT * INTO v_booking
  FROM subsystem_bookings
  WHERE id = p_booking_id
  AND status = 'active';
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Cancel the booking
  UPDATE subsystem_bookings
  SET status = 'cancelled',
      updated_at = NOW()
  WHERE id = p_booking_id;
  
  -- If booking was active (current time within booking period), unlock the subsystem
  IF v_booking.booking_start <= NOW() AND v_booking.booking_end > NOW() THEN
    UPDATE subsystems
    SET is_locked = false,
        locked_by = NULL,
        locked_at = NULL,
        booking_start = NULL,
        booking_end = NULL
    WHERE id = v_booking.subsystem_id
    AND locked_by = v_booking.user_id;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION cancel_system_booking(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION cancel_subsystem_booking(UUID) TO authenticated;

-- Test function to check if sivarajan is recognized as admin
CREATE OR REPLACE FUNCTION check_user_admin_status(username_to_check TEXT)
RETURNS TABLE(
  user_id UUID,
  username TEXT,
  has_user_role BOOLEAN,
  has_profile_role BOOLEAN,
  is_admin_result BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as user_id,
    p.username,
    EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id = p.id AND ur.role = 'admin') as has_user_role,
    (p.role = 'admin') as has_profile_role,
    public.is_admin() as is_admin_result
  FROM profiles p
  WHERE p.username = username_to_check;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check sivarajan's admin status
SELECT * FROM check_user_admin_status('sivarajan');

-- If sivarajan doesn't have admin role in user_roles table, add it:
-- INSERT INTO user_roles (user_id, role) 
-- SELECT id, 'admin'::app_role 
-- FROM profiles 
-- WHERE username = 'sivarajan'
-- ON CONFLICT (user_id, role) DO NOTHING;

-- ========================================
-- MIGRATION COMPLETE
-- 
-- This fixes the admin permission check to work with both:
-- 1. user_roles table (primary method)
-- 2. profiles.role column (fallback)
-- ========================================