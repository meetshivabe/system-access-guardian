-- ========================================
-- FIX BOOKING STATUS AFTER CANCELLATION
-- Run this SQL in your Supabase SQL Editor
-- ========================================

-- Update cancel_system_booking to properly handle status after cancellation
DROP FUNCTION IF EXISTS cancel_system_booking(UUID);
CREATE OR REPLACE FUNCTION cancel_system_booking(p_booking_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_is_admin BOOLEAN;
  v_booking RECORD;
  v_remaining_bookings INTEGER;
BEGIN
  -- Check if user is admin
  v_user_is_admin := public.is_admin();
  
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
  
  -- Check if there are any remaining active bookings for this system
  SELECT COUNT(*) INTO v_remaining_bookings
  FROM system_bookings
  WHERE system_id = v_booking.system_id
  AND status = 'active'
  AND id != p_booking_id;
  
  -- If no remaining bookings, ensure system is unlocked
  IF v_remaining_bookings = 0 THEN
    UPDATE systems
    SET is_locked = false,
        locked_by = NULL,
        locked_at = NULL,
        booking_start = NULL,
        booking_end = NULL
    WHERE id = v_booking.system_id;
  ELSE
    -- If booking was active (current time within booking period), unlock the system
    IF v_booking.booking_start <= NOW() AND v_booking.booking_end > NOW() THEN
      -- Check if another booking should take over
      UPDATE systems s
      SET is_locked = CASE 
            WHEN EXISTS (
              SELECT 1 FROM system_bookings sb
              WHERE sb.system_id = s.id
              AND sb.status = 'active'
              AND sb.booking_start <= NOW()
              AND sb.booking_end > NOW()
              AND sb.id != p_booking_id
            ) THEN true
            ELSE false
          END,
          locked_by = (
            SELECT sb.user_id FROM system_bookings sb
            WHERE sb.system_id = s.id
            AND sb.status = 'active'
            AND sb.booking_start <= NOW()
            AND sb.booking_end > NOW()
            AND sb.id != p_booking_id
            ORDER BY sb.booking_start
            LIMIT 1
          ),
          locked_at = CASE 
            WHEN EXISTS (
              SELECT 1 FROM system_bookings sb
              WHERE sb.system_id = s.id
              AND sb.status = 'active'
              AND sb.booking_start <= NOW()
              AND sb.booking_end > NOW()
              AND sb.id != p_booking_id
            ) THEN NOW()
            ELSE NULL
          END,
          booking_start = (
            SELECT sb.booking_start FROM system_bookings sb
            WHERE sb.system_id = s.id
            AND sb.status = 'active'
            AND sb.booking_start <= NOW()
            AND sb.booking_end > NOW()
            AND sb.id != p_booking_id
            ORDER BY sb.booking_start
            LIMIT 1
          ),
          booking_end = (
            SELECT sb.booking_end FROM system_bookings sb
            WHERE sb.system_id = s.id
            AND sb.status = 'active'
            AND sb.booking_start <= NOW()
            AND sb.booking_end > NOW()
            AND sb.id != p_booking_id
            ORDER BY sb.booking_start
            LIMIT 1
          )
      WHERE id = v_booking.system_id;
    END IF;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update cancel_subsystem_booking similarly
DROP FUNCTION IF EXISTS cancel_subsystem_booking(UUID);
CREATE OR REPLACE FUNCTION cancel_subsystem_booking(p_booking_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_is_admin BOOLEAN;
  v_booking RECORD;
  v_remaining_bookings INTEGER;
BEGIN
  -- Check if user is admin
  v_user_is_admin := public.is_admin();
  
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
  
  -- Check if there are any remaining active bookings for this subsystem
  SELECT COUNT(*) INTO v_remaining_bookings
  FROM subsystem_bookings
  WHERE subsystem_id = v_booking.subsystem_id
  AND status = 'active'
  AND id != p_booking_id;
  
  -- If no remaining bookings, ensure subsystem is unlocked
  IF v_remaining_bookings = 0 THEN
    UPDATE subsystems
    SET is_locked = false,
        locked_by = NULL,
        locked_at = NULL,
        booking_start = NULL,
        booking_end = NULL
    WHERE id = v_booking.subsystem_id;
  ELSE
    -- If booking was active (current time within booking period), unlock the subsystem
    IF v_booking.booking_start <= NOW() AND v_booking.booking_end > NOW() THEN
      -- Check if another booking should take over
      UPDATE subsystems s
      SET is_locked = CASE 
            WHEN EXISTS (
              SELECT 1 FROM subsystem_bookings sb
              WHERE sb.subsystem_id = s.id
              AND sb.status = 'active'
              AND sb.booking_start <= NOW()
              AND sb.booking_end > NOW()
              AND sb.id != p_booking_id
            ) THEN true
            ELSE false
          END,
          locked_by = (
            SELECT sb.user_id FROM subsystem_bookings sb
            WHERE sb.subsystem_id = s.id
            AND sb.status = 'active'
            AND sb.booking_start <= NOW()
            AND sb.booking_end > NOW()
            AND sb.id != p_booking_id
            ORDER BY sb.booking_start
            LIMIT 1
          ),
          locked_at = CASE 
            WHEN EXISTS (
              SELECT 1 FROM subsystem_bookings sb
              WHERE sb.subsystem_id = s.id
              AND sb.status = 'active'
              AND sb.booking_start <= NOW()
              AND sb.booking_end > NOW()
              AND sb.id != p_booking_id
            ) THEN NOW()
            ELSE NULL
          END,
          booking_start = (
            SELECT sb.booking_start FROM subsystem_bookings sb
            WHERE sb.subsystem_id = s.id
            AND sb.status = 'active'
            AND sb.booking_start <= NOW()
            AND sb.booking_end > NOW()
            AND sb.id != p_booking_id
            ORDER BY sb.booking_start
            LIMIT 1
          ),
          booking_end = (
            SELECT sb.booking_end FROM subsystem_bookings sb
            WHERE sb.subsystem_id = s.id
            AND sb.status = 'active'
            AND sb.booking_start <= NOW()
            AND sb.booking_end > NOW()
            AND sb.id != p_booking_id
            ORDER BY sb.booking_start
            LIMIT 1
          )
      WHERE id = v_booking.subsystem_id;
    END IF;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION cancel_system_booking(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION cancel_subsystem_booking(UUID) TO authenticated;

-- ========================================
-- MIGRATION COMPLETE
-- 
-- This fixes the booking cancellation to:
-- 1. Unlock system/subsystem when last booking is cancelled
-- 2. Transfer lock to next active booking if one exists
-- 3. Show "Available" status when no bookings remain
-- ========================================