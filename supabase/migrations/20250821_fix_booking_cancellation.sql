-- ========================================
-- FIX BOOKING CANCELLATION TO PROPERLY CLEAR FIELDS
-- This ensures that when a booking is cancelled, the booking_start
-- and booking_end fields are properly cleared from systems/subsystems
-- ========================================

-- Update cancel_system_booking to ensure proper cleanup
CREATE OR REPLACE FUNCTION cancel_system_booking(p_booking_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_is_admin BOOLEAN;
  v_booking RECORD;
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
  
  -- Always clear the booking fields from the system if this was the active booking
  UPDATE systems
  SET booking_start = NULL,
      booking_end = NULL,
      -- If booking was currently active, also unlock the system
      is_locked = CASE 
        WHEN v_booking.booking_start <= NOW() AND v_booking.booking_end > NOW() 
        THEN false 
        ELSE is_locked 
      END,
      locked_by = CASE 
        WHEN v_booking.booking_start <= NOW() AND v_booking.booking_end > NOW() 
        THEN NULL 
        ELSE locked_by 
      END,
      locked_at = CASE 
        WHEN v_booking.booking_start <= NOW() AND v_booking.booking_end > NOW() 
        THEN NULL 
        ELSE locked_at 
      END
  WHERE id = v_booking.system_id
  AND (
    -- Clear if this booking matches the current booking fields
    (booking_start = v_booking.booking_start AND booking_end = v_booking.booking_end)
    OR 
    -- Or if it was the active lock holder
    (v_booking.booking_start <= NOW() AND v_booking.booking_end > NOW() AND locked_by = v_booking.user_id)
  );
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update cancel_subsystem_booking similarly
CREATE OR REPLACE FUNCTION cancel_subsystem_booking(p_booking_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_is_admin BOOLEAN;
  v_booking RECORD;
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
  
  -- Always clear the booking fields from the subsystem if this was the active booking
  UPDATE subsystems
  SET booking_start = NULL,
      booking_end = NULL,
      -- If booking was currently active, also unlock the subsystem
      is_locked = CASE 
        WHEN v_booking.booking_start <= NOW() AND v_booking.booking_end > NOW() 
        THEN false 
        ELSE is_locked 
      END,
      locked_by = CASE 
        WHEN v_booking.booking_start <= NOW() AND v_booking.booking_end > NOW() 
        THEN NULL 
        ELSE locked_by 
      END,
      locked_at = CASE 
        WHEN v_booking.booking_start <= NOW() AND v_booking.booking_end > NOW() 
        THEN NULL 
        ELSE locked_at 
      END
  WHERE id = v_booking.subsystem_id
  AND (
    -- Clear if this booking matches the current booking fields
    (booking_start = v_booking.booking_start AND booking_end = v_booking.booking_end)
    OR 
    -- Or if it was the active lock holder
    (v_booking.booking_start <= NOW() AND v_booking.booking_end > NOW() AND locked_by = v_booking.user_id)
  );
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION cancel_system_booking(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION cancel_subsystem_booking(UUID) TO authenticated;

-- ========================================
-- MIGRATION COMPLETE
-- This ensures proper cleanup of booking fields when cancelling
-- ========================================