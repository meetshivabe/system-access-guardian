-- ========================================
-- SYNC BOOKING STATUS AND CLEAN ORPHANED DATA
-- This fixes cases where systems show as booked but have no active bookings
-- ========================================

-- Function to clean up orphaned booking data in systems table
CREATE OR REPLACE FUNCTION cleanup_orphaned_bookings()
RETURNS void AS $$
DECLARE
  sys RECORD;
  sub RECORD;
  active_booking RECORD;
BEGIN
  -- Clean up systems
  FOR sys IN SELECT * FROM systems WHERE booking_start IS NOT NULL OR booking_end IS NOT NULL
  LOOP
    -- Check if there's an actual active booking for this system
    SELECT * INTO active_booking
    FROM system_bookings
    WHERE system_id = sys.id
    AND status = 'active'
    AND booking_start <= NOW()
    AND booking_end > NOW()
    LIMIT 1;
    
    IF NOT FOUND THEN
      -- No active booking found, clear the booking fields
      UPDATE systems
      SET booking_start = NULL,
          booking_end = NULL,
          -- Also unlock if it was locked without an active booking
          is_locked = CASE 
            WHEN is_locked = true AND locked_by IS NOT NULL THEN false
            ELSE is_locked
          END,
          locked_by = CASE 
            WHEN is_locked = true AND locked_by IS NOT NULL THEN NULL
            ELSE locked_by
          END,
          locked_at = CASE 
            WHEN is_locked = true AND locked_by IS NOT NULL THEN NULL
            ELSE locked_at
          END
      WHERE id = sys.id;
      
      RAISE NOTICE 'Cleaned up orphaned booking for system %', sys.name;
    ELSE
      -- Ensure the booking fields match the actual active booking
      UPDATE systems
      SET booking_start = active_booking.booking_start,
          booking_end = active_booking.booking_end,
          is_locked = true,
          locked_by = active_booking.user_id,
          locked_at = COALESCE(locked_at, active_booking.booking_start)
      WHERE id = sys.id;
    END IF;
  END LOOP;
  
  -- Clean up subsystems
  FOR sub IN SELECT * FROM subsystems WHERE booking_start IS NOT NULL OR booking_end IS NOT NULL
  LOOP
    -- Check if there's an actual active booking for this subsystem
    SELECT * INTO active_booking
    FROM subsystem_bookings
    WHERE subsystem_id = sub.id
    AND status = 'active'
    AND booking_start <= NOW()
    AND booking_end > NOW()
    LIMIT 1;
    
    IF NOT FOUND THEN
      -- No active booking found, clear the booking fields
      UPDATE subsystems
      SET booking_start = NULL,
          booking_end = NULL,
          -- Also unlock if it was locked without an active booking
          is_locked = CASE 
            WHEN is_locked = true AND locked_by IS NOT NULL THEN false
            ELSE is_locked
          END,
          locked_by = CASE 
            WHEN is_locked = true AND locked_by IS NOT NULL THEN NULL
            ELSE locked_by
          END,
          locked_at = CASE 
            WHEN is_locked = true AND locked_by IS NOT NULL THEN NULL
            ELSE locked_at
          END
      WHERE id = sub.id;
      
      RAISE NOTICE 'Cleaned up orphaned booking for subsystem %', sub.name;
    ELSE
      -- Ensure the booking fields match the actual active booking
      UPDATE subsystems
      SET booking_start = active_booking.booking_start,
          booking_end = active_booking.booking_end,
          is_locked = true,
          locked_by = active_booking.user_id,
          locked_at = COALESCE(locked_at, active_booking.booking_start)
      WHERE id = sub.id;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Run the cleanup immediately
SELECT cleanup_orphaned_bookings();

-- Update the process_active_bookings function to be more robust
CREATE OR REPLACE FUNCTION process_active_bookings()
RETURNS void AS $$
DECLARE
  booking RECORD;
  current_time TIMESTAMP WITH TIME ZONE := NOW();
BEGIN
  -- First, mark expired bookings as completed
  UPDATE system_bookings 
  SET status = 'completed'
  WHERE status = 'active' 
  AND booking_end <= current_time;
  
  UPDATE subsystem_bookings 
  SET status = 'completed'
  WHERE status = 'active' 
  AND booking_end <= current_time;
  
  -- Process system bookings
  FOR booking IN 
    SELECT sb.*, p.username 
    FROM system_bookings sb
    JOIN profiles p ON sb.user_id = p.id
    WHERE sb.status = 'active'
  LOOP
    IF booking.booking_start <= current_time AND booking.booking_end > current_time THEN
      -- Lock the system for the booked user
      UPDATE systems 
      SET is_locked = true, 
          locked_by = booking.user_id, 
          locked_at = booking.booking_start,
          booking_start = booking.booking_start,
          booking_end = booking.booking_end
      WHERE id = booking.system_id;
    ELSIF booking.booking_end <= current_time THEN
      -- Unlock the system and clear booking fields
      UPDATE systems 
      SET is_locked = false, 
          locked_by = NULL, 
          locked_at = NULL,
          booking_start = NULL,
          booking_end = NULL
      WHERE id = booking.system_id;
      
      -- Mark booking as completed
      UPDATE system_bookings 
      SET status = 'completed' 
      WHERE id = booking.id;
    END IF;
  END LOOP;

  -- Process subsystem bookings
  FOR booking IN 
    SELECT sb.*, p.username 
    FROM subsystem_bookings sb
    JOIN profiles p ON sb.user_id = p.id
    WHERE sb.status = 'active'
  LOOP
    IF booking.booking_start <= current_time AND booking.booking_end > current_time THEN
      -- Lock the subsystem for the booked user
      UPDATE subsystems 
      SET is_locked = true, 
          locked_by = booking.user_id, 
          locked_at = booking.booking_start,
          booking_start = booking.booking_start,
          booking_end = booking.booking_end
      WHERE id = booking.subsystem_id;
    ELSIF booking.booking_end <= current_time THEN
      -- Unlock the subsystem and clear booking fields
      UPDATE subsystems 
      SET is_locked = false, 
          locked_by = NULL, 
          locked_at = NULL,
          booking_start = NULL,
          booking_end = NULL
      WHERE id = booking.subsystem_id;
      
      -- Mark booking as completed
      UPDATE subsystem_bookings 
      SET status = 'completed' 
      WHERE id = booking.id;
    END IF;
  END LOOP;
  
  -- Clean up any orphaned bookings (where booking fields exist but no active booking)
  UPDATE systems s
  SET booking_start = NULL,
      booking_end = NULL,
      is_locked = false,
      locked_by = NULL,
      locked_at = NULL
  WHERE (booking_start IS NOT NULL OR booking_end IS NOT NULL)
  AND NOT EXISTS (
    SELECT 1 FROM system_bookings sb 
    WHERE sb.system_id = s.id 
    AND sb.status = 'active'
    AND sb.booking_start <= current_time
    AND sb.booking_end > current_time
  );
  
  UPDATE subsystems s
  SET booking_start = NULL,
      booking_end = NULL,
      is_locked = false,
      locked_by = NULL,
      locked_at = NULL
  WHERE (booking_start IS NOT NULL OR booking_end IS NOT NULL)
  AND NOT EXISTS (
    SELECT 1 FROM subsystem_bookings sb 
    WHERE sb.subsystem_id = s.id 
    AND sb.status = 'active'
    AND sb.booking_start <= current_time
    AND sb.booking_end > current_time
  );
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to auto-cleanup when bookings change
CREATE OR REPLACE FUNCTION trigger_sync_booking_status()
RETURNS TRIGGER AS $$
BEGIN
  -- When a booking is cancelled or completed, clear the system fields
  IF (TG_OP = 'UPDATE' AND NEW.status != 'active' AND OLD.status = 'active') THEN
    IF TG_TABLE_NAME = 'system_bookings' THEN
      UPDATE systems
      SET booking_start = NULL,
          booking_end = NULL,
          is_locked = CASE 
            WHEN OLD.booking_start <= NOW() AND OLD.booking_end > NOW() THEN false
            ELSE is_locked
          END,
          locked_by = CASE 
            WHEN OLD.booking_start <= NOW() AND OLD.booking_end > NOW() THEN NULL
            ELSE locked_by
          END,
          locked_at = CASE 
            WHEN OLD.booking_start <= NOW() AND OLD.booking_end > NOW() THEN NULL
            ELSE locked_at
          END
      WHERE id = NEW.system_id;
    ELSIF TG_TABLE_NAME = 'subsystem_bookings' THEN
      UPDATE subsystems
      SET booking_start = NULL,
          booking_end = NULL,
          is_locked = CASE 
            WHEN OLD.booking_start <= NOW() AND OLD.booking_end > NOW() THEN false
            ELSE is_locked
          END,
          locked_by = CASE 
            WHEN OLD.booking_start <= NOW() AND OLD.booking_end > NOW() THEN NULL
            ELSE locked_by
          END,
          locked_at = CASE 
            WHEN OLD.booking_start <= NOW() AND OLD.booking_end > NOW() THEN NULL
            ELSE locked_at
          END
      WHERE id = NEW.subsystem_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS sync_system_booking_status ON system_bookings;
DROP TRIGGER IF EXISTS sync_subsystem_booking_status ON subsystem_bookings;

-- Create triggers
CREATE TRIGGER sync_system_booking_status
AFTER UPDATE ON system_bookings
FOR EACH ROW EXECUTE FUNCTION trigger_sync_booking_status();

CREATE TRIGGER sync_subsystem_booking_status
AFTER UPDATE ON subsystem_bookings
FOR EACH ROW EXECUTE FUNCTION trigger_sync_booking_status();

-- Grant permissions
GRANT EXECUTE ON FUNCTION cleanup_orphaned_bookings() TO authenticated;
GRANT EXECUTE ON FUNCTION process_active_bookings() TO authenticated;

-- ========================================
-- MIGRATION COMPLETE
-- This ensures booking status is always synchronized
-- Run cleanup_orphaned_bookings() to fix any existing issues
-- ========================================