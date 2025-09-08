-- ========================================
-- ALLOW USERS TO CANCEL THEIR OWN BOOKINGS
-- ========================================

-- Function to allow users to cancel their own system bookings
CREATE OR REPLACE FUNCTION cancel_user_system_booking(
  p_booking_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_booking RECORD;
BEGIN
  -- Get booking details and verify ownership
  SELECT * INTO v_booking
  FROM system_bookings
  WHERE id = p_booking_id
  AND user_id = p_user_id  -- User can only cancel their own bookings
  AND status = 'active';
  
  IF NOT FOUND THEN
    -- Check if user is admin - admins can cancel any booking
    IF public.is_admin() THEN
      SELECT * INTO v_booking
      FROM system_bookings
      WHERE id = p_booking_id
      AND status = 'active';
      
      IF NOT FOUND THEN
        RETURN FALSE;
      END IF;
    ELSE
      RETURN FALSE;  -- Not the owner and not an admin
    END IF;
  END IF;
  
  -- Cancel the booking
  UPDATE system_bookings
  SET status = 'cancelled',
      updated_at = NOW()
  WHERE id = p_booking_id;
  
  -- Clear the booking fields from the system
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

-- Function to allow users to cancel their own subsystem bookings
CREATE OR REPLACE FUNCTION cancel_user_subsystem_booking(
  p_booking_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_booking RECORD;
BEGIN
  -- Get booking details and verify ownership
  SELECT * INTO v_booking
  FROM subsystem_bookings
  WHERE id = p_booking_id
  AND user_id = p_user_id  -- User can only cancel their own bookings
  AND status = 'active';
  
  IF NOT FOUND THEN
    -- Check if user is admin - admins can cancel any booking
    IF public.is_admin() THEN
      SELECT * INTO v_booking
      FROM subsystem_bookings
      WHERE id = p_booking_id
      AND status = 'active';
      
      IF NOT FOUND THEN
        RETURN FALSE;
      END IF;
    ELSE
      RETURN FALSE;  -- Not the owner and not an admin
    END IF;
  END IF;
  
  -- Cancel the booking
  UPDATE subsystem_bookings
  SET status = 'cancelled',
      updated_at = NOW()
  WHERE id = p_booking_id;
  
  -- Clear the booking fields from the subsystem
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

-- Grant permissions to authenticated users
GRANT EXECUTE ON FUNCTION cancel_user_system_booking(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION cancel_user_subsystem_booking(UUID, UUID) TO authenticated;

-- ========================================
-- MIGRATION COMPLETE
-- Users can now cancel their own bookings
-- Admins can still cancel any booking
-- ========================================