-- ========================================
-- FIX LOCK STATUS SYNC WITH BOOKINGS
-- Run this SQL in your Supabase SQL Editor
-- ========================================

-- Function to sync lock status with active bookings
CREATE OR REPLACE FUNCTION sync_lock_status_with_bookings()
RETURNS void AS $$
DECLARE
  system_rec RECORD;
  subsystem_rec RECORD;
  active_booking RECORD;
BEGIN
  -- Sync systems
  FOR system_rec IN SELECT * FROM systems
  LOOP
    -- Find current active booking for this system
    SELECT * INTO active_booking
    FROM system_bookings
    WHERE system_id = system_rec.id
    AND status = 'active'
    AND booking_start <= NOW()
    AND booking_end > NOW()
    ORDER BY booking_start
    LIMIT 1;
    
    IF FOUND THEN
      -- Update system with active booking info
      UPDATE systems
      SET is_locked = true,
          locked_by = active_booking.user_id,
          locked_at = GREATEST(active_booking.booking_start, system_rec.locked_at),
          booking_start = active_booking.booking_start,
          booking_end = active_booking.booking_end
      WHERE id = system_rec.id
      AND (locked_by != active_booking.user_id OR NOT is_locked);
    ELSE
      -- Check if there are only future bookings
      SELECT * INTO active_booking
      FROM system_bookings
      WHERE system_id = system_rec.id
      AND status = 'active'
      AND booking_start > NOW()
      ORDER BY booking_start
      LIMIT 1;
      
      IF FOUND THEN
        -- Has future booking but not active - should be unlocked but show booking dates
        UPDATE systems
        SET is_locked = false,
            locked_by = NULL,
            locked_at = NULL,
            booking_start = active_booking.booking_start,
            booking_end = active_booking.booking_end
        WHERE id = system_rec.id
        AND is_locked = true;
      ELSE
        -- No bookings at all - should be completely available
        UPDATE systems
        SET is_locked = false,
            locked_by = NULL,
            locked_at = NULL,
            booking_start = NULL,
            booking_end = NULL
        WHERE id = system_rec.id
        AND (is_locked = true OR booking_start IS NOT NULL);
      END IF;
    END IF;
  END LOOP;
  
  -- Sync subsystems
  FOR subsystem_rec IN SELECT * FROM subsystems
  LOOP
    -- Find current active booking for this subsystem
    SELECT * INTO active_booking
    FROM subsystem_bookings
    WHERE subsystem_id = subsystem_rec.id
    AND status = 'active'
    AND booking_start <= NOW()
    AND booking_end > NOW()
    ORDER BY booking_start
    LIMIT 1;
    
    IF FOUND THEN
      -- Update subsystem with active booking info
      UPDATE subsystems
      SET is_locked = true,
          locked_by = active_booking.user_id,
          locked_at = GREATEST(active_booking.booking_start, subsystem_rec.locked_at),
          booking_start = active_booking.booking_start,
          booking_end = active_booking.booking_end
      WHERE id = subsystem_rec.id
      AND (locked_by != active_booking.user_id OR NOT is_locked);
    ELSE
      -- Check if there are only future bookings
      SELECT * INTO active_booking
      FROM subsystem_bookings
      WHERE subsystem_id = subsystem_rec.id
      AND status = 'active'
      AND booking_start > NOW()
      ORDER BY booking_start
      LIMIT 1;
      
      IF FOUND THEN
        -- Has future booking but not active - should be unlocked
        UPDATE subsystems
        SET is_locked = false,
            locked_by = NULL,
            locked_at = NULL,
            booking_start = active_booking.booking_start,
            booking_end = active_booking.booking_end
        WHERE id = subsystem_rec.id
        AND is_locked = true;
      ELSE
        -- No bookings at all - should be completely available
        UPDATE subsystems
        SET is_locked = false,
            locked_by = NULL,
            locked_at = NULL,
            booking_start = NULL,
            booking_end = NULL
        WHERE id = subsystem_rec.id
        AND (is_locked = true OR booking_start IS NOT NULL);
      END IF;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Run the sync immediately to fix current inconsistencies
SELECT sync_lock_status_with_bookings();

-- Also update the process_active_bookings function to use proper user_id
DROP FUNCTION IF EXISTS process_active_bookings();
CREATE OR REPLACE FUNCTION process_active_bookings()
RETURNS void AS $$
DECLARE
  booking RECORD;
  current_time TIMESTAMP WITH TIME ZONE := NOW();
BEGIN
  -- First sync all lock statuses
  PERFORM sync_lock_status_with_bookings();
  
  -- Process system bookings
  FOR booking IN 
    SELECT sb.*, p.username 
    FROM system_bookings sb
    JOIN profiles p ON sb.user_id = p.id
    WHERE sb.status = 'active'
  LOOP
    -- Only lock if booking has started
    IF booking.booking_start <= current_time AND booking.booking_end > current_time THEN
      -- Lock the system for the booked user
      UPDATE systems 
      SET is_locked = true, 
          locked_by = booking.user_id, 
          locked_at = GREATEST(booking.booking_start, current_time),
          booking_start = booking.booking_start,
          booking_end = booking.booking_end
      WHERE id = booking.system_id 
      AND (is_locked = false OR locked_by != booking.user_id);
      
    ELSIF booking.booking_end <= current_time THEN
      -- Booking has ended - mark as completed
      UPDATE system_bookings 
      SET status = 'completed',
          updated_at = current_time
      WHERE id = booking.id;
      
      -- Check if there's another active booking to take over
      PERFORM sync_lock_status_with_bookings();
    END IF;
  END LOOP;

  -- Process subsystem bookings
  FOR booking IN 
    SELECT sb.*, p.username 
    FROM subsystem_bookings sb
    JOIN profiles p ON sb.user_id = p.id
    WHERE sb.status = 'active'
  LOOP
    -- Only lock if booking has started
    IF booking.booking_start <= current_time AND booking.booking_end > current_time THEN
      -- Lock the subsystem for the booked user
      UPDATE subsystems 
      SET is_locked = true, 
          locked_by = booking.user_id, 
          locked_at = GREATEST(booking.booking_start, current_time),
          booking_start = booking.booking_start,
          booking_end = booking.booking_end
      WHERE id = booking.subsystem_id 
      AND (is_locked = false OR locked_by != booking.user_id);
      
    ELSIF booking.booking_end <= current_time THEN
      -- Booking has ended - mark as completed
      UPDATE subsystem_bookings 
      SET status = 'completed',
          updated_at = current_time
      WHERE id = booking.id;
      
      -- Check if there's another active booking to take over
      PERFORM sync_lock_status_with_bookings();
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION sync_lock_status_with_bookings() TO authenticated;
GRANT EXECUTE ON FUNCTION process_active_bookings() TO authenticated;

-- Create a debug view to see the current state
CREATE OR REPLACE VIEW lock_status_debug AS
SELECT 
  s.id,
  s.name as system_name,
  s.is_locked,
  p1.username as locked_by_username,
  s.locked_at,
  s.booking_start,
  s.booking_end,
  sb.id as active_booking_id,
  p2.username as active_booking_by,
  sb.booking_start as active_booking_start,
  sb.booking_end as active_booking_end,
  CASE 
    WHEN s.is_locked AND p1.username != p2.username THEN 'MISMATCH'
    WHEN s.is_locked AND sb.id IS NULL THEN 'LOCKED_NO_BOOKING'
    WHEN NOT s.is_locked AND sb.id IS NOT NULL AND sb.booking_start <= NOW() THEN 'UNLOCKED_WITH_ACTIVE'
    ELSE 'OK'
  END as status_check
FROM systems s
LEFT JOIN profiles p1 ON s.locked_by = p1.id
LEFT JOIN LATERAL (
  SELECT * FROM system_bookings
  WHERE system_id = s.id
  AND status = 'active'
  AND booking_start <= NOW()
  AND booking_end > NOW()
  ORDER BY booking_start
  LIMIT 1
) sb ON true
LEFT JOIN profiles p2 ON sb.user_id = p2.id;

GRANT SELECT ON lock_status_debug TO authenticated;

-- Check current status
SELECT * FROM lock_status_debug WHERE status_check != 'OK';

-- ========================================
-- MIGRATION COMPLETE
-- 
-- This fixes lock status synchronization:
-- 1. Syncs locked_by with actual active booking user
-- 2. Clears stale lock data
-- 3. Provides debug view to identify mismatches
-- ========================================