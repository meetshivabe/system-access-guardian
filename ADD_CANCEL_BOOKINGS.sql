-- ========================================
-- ADD BOOKING CANCELLATION FOR ADMINS
-- Run this SQL in your Supabase SQL Editor
-- ========================================

-- 1. Create function to cancel a system booking
CREATE OR REPLACE FUNCTION cancel_system_booking(p_booking_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_is_admin BOOLEAN;
  v_booking RECORD;
BEGIN
  -- Check if user is admin
  SELECT public.is_admin() INTO v_user_is_admin;
  
  IF NOT v_user_is_admin THEN
    RAISE EXCEPTION 'Only administrators can cancel bookings';
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

-- 2. Create function to cancel a subsystem booking
CREATE OR REPLACE FUNCTION cancel_subsystem_booking(p_booking_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_is_admin BOOLEAN;
  v_booking RECORD;
BEGIN
  -- Check if user is admin
  SELECT public.is_admin() INTO v_user_is_admin;
  
  IF NOT v_user_is_admin THEN
    RAISE EXCEPTION 'Only administrators can cancel bookings';
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

-- 3. Create view for all active bookings with user details
CREATE OR REPLACE VIEW active_bookings_admin AS
SELECT 
  'system' as booking_type,
  sb.id as booking_id,
  sb.system_id as resource_id,
  s.name as resource_name,
  sb.user_id,
  p.username,
  p.email as user_email,
  sb.booking_start,
  sb.booking_end,
  sb.status,
  sb.created_at,
  CASE 
    WHEN sb.booking_start > NOW() THEN 'future'
    WHEN sb.booking_start <= NOW() AND sb.booking_end > NOW() THEN 'active'
    ELSE 'expired'
  END as booking_state
FROM system_bookings sb
JOIN systems s ON sb.system_id = s.id
JOIN profiles p ON sb.user_id = p.id
WHERE sb.status = 'active'

UNION ALL

SELECT 
  'subsystem' as booking_type,
  sb.id as booking_id,
  sb.subsystem_id as resource_id,
  ss.name as resource_name,
  sb.user_id,
  p.username,
  p.email as user_email,
  sb.booking_start,
  sb.booking_end,
  sb.status,
  sb.created_at,
  CASE 
    WHEN sb.booking_start > NOW() THEN 'future'
    WHEN sb.booking_start <= NOW() AND sb.booking_end > NOW() THEN 'active'
    ELSE 'expired'
  END as booking_state
FROM subsystem_bookings sb
JOIN subsystems ss ON sb.subsystem_id = ss.id
JOIN profiles p ON sb.user_id = p.id
WHERE sb.status = 'active'
ORDER BY booking_start ASC;

-- 4. Grant permissions
GRANT EXECUTE ON FUNCTION cancel_system_booking(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION cancel_subsystem_booking(UUID) TO authenticated;
GRANT SELECT ON active_bookings_admin TO authenticated;

-- ========================================
-- MIGRATION COMPLETE
-- 
-- This migration adds:
-- 1. Functions to cancel bookings (admin only)
-- 2. View to see all active bookings
-- 3. Proper cleanup when cancelling active bookings
-- ========================================