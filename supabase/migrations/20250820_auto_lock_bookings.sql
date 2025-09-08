-- Function to automatically lock systems when booking period starts
CREATE OR REPLACE FUNCTION auto_lock_active_bookings()
RETURNS void AS $$
DECLARE
  booking RECORD;
  current_time TIMESTAMP WITH TIME ZONE := NOW();
BEGIN
  -- Process system bookings that should be locked
  FOR booking IN 
    SELECT sb.*, p.username 
    FROM system_bookings sb
    JOIN profiles p ON sb.user_id = p.id
    WHERE sb.status = 'active'
    AND sb.booking_start <= current_time 
    AND sb.booking_end > current_time
  LOOP
    -- Lock the system for the booked user if not already locked by them
    UPDATE systems 
    SET is_locked = true, 
        locked_by = booking.user_id, 
        locked_at = GREATEST(booking.booking_start, current_time),
        booking_start = booking.booking_start,
        booking_end = booking.booking_end
    WHERE id = booking.system_id 
    AND (is_locked = false OR locked_by != booking.user_id);
    
    -- Create utilization tracking if doesn't exist
    INSERT INTO system_utilization (system_id, user_id, locked_at)
    SELECT booking.system_id, booking.user_id, GREATEST(booking.booking_start, current_time)
    WHERE NOT EXISTS (
      SELECT 1 FROM system_utilization 
      WHERE system_id = booking.system_id 
      AND user_id = booking.user_id 
      AND unlocked_at IS NULL
    );
  END LOOP;

  -- Process subsystem bookings that should be locked
  FOR booking IN 
    SELECT sb.*, p.username 
    FROM subsystem_bookings sb
    JOIN profiles p ON sb.user_id = p.id
    WHERE sb.status = 'active'
    AND sb.booking_start <= current_time 
    AND sb.booking_end > current_time
  LOOP
    -- Lock the subsystem for the booked user if not already locked by them
    UPDATE subsystems 
    SET is_locked = true, 
        locked_by = booking.user_id, 
        locked_at = GREATEST(booking.booking_start, current_time),
        booking_start = booking.booking_start,
        booking_end = booking.booking_end
    WHERE id = booking.subsystem_id 
    AND (is_locked = false OR locked_by != booking.user_id);
    
    -- Create utilization tracking if doesn't exist
    INSERT INTO subsystem_utilization (subsystem_id, system_id, user_id, locked_at)
    SELECT booking.subsystem_id, booking.system_id, booking.user_id, GREATEST(booking.booking_start, current_time)
    WHERE NOT EXISTS (
      SELECT 1 FROM subsystem_utilization 
      WHERE subsystem_id = booking.subsystem_id 
      AND user_id = booking.user_id 
      AND unlocked_at IS NULL
    );
  END LOOP;

  -- Process expired bookings that should be unlocked
  FOR booking IN 
    SELECT sb.* 
    FROM system_bookings sb
    WHERE sb.status = 'active'
    AND sb.booking_end <= current_time
  LOOP
    -- Unlock the system
    UPDATE systems 
    SET is_locked = false, 
        locked_by = NULL, 
        locked_at = NULL,
        booking_start = NULL,
        booking_end = NULL
    WHERE id = booking.system_id 
    AND locked_by = booking.user_id;
    
    -- Update utilization tracking
    UPDATE system_utilization 
    SET unlocked_at = booking.booking_end
    WHERE system_id = booking.system_id 
    AND user_id = booking.user_id 
    AND unlocked_at IS NULL;
    
    -- Mark booking as completed
    UPDATE system_bookings 
    SET status = 'completed' 
    WHERE id = booking.id;
  END LOOP;

  -- Process expired subsystem bookings that should be unlocked
  FOR booking IN 
    SELECT sb.* 
    FROM subsystem_bookings sb
    WHERE sb.status = 'active'
    AND sb.booking_end <= current_time
  LOOP
    -- Unlock the subsystem
    UPDATE subsystems 
    SET is_locked = false, 
        locked_by = NULL, 
        locked_at = NULL,
        booking_start = NULL,
        booking_end = NULL
    WHERE id = booking.subsystem_id 
    AND locked_by = booking.user_id;
    
    -- Update utilization tracking
    UPDATE subsystem_utilization 
    SET unlocked_at = booking.booking_end
    WHERE subsystem_id = booking.subsystem_id 
    AND user_id = booking.user_id 
    AND unlocked_at IS NULL;
    
    -- Mark booking as completed
    UPDATE subsystem_bookings 
    SET status = 'completed' 
    WHERE id = booking.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create a cron job to run this function every minute (requires pg_cron extension)
-- Note: If pg_cron is not available, this function can be called from your application
-- or triggered by a scheduled job service

-- For Supabase, you can set up an Edge Function to call this periodically
-- Or use a database trigger on booking inserts/updates
CREATE OR REPLACE FUNCTION trigger_auto_lock_on_booking_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Call the auto lock function whenever a booking is created or updated
  PERFORM auto_lock_active_bookings();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to auto-lock when bookings are created/updated
DROP TRIGGER IF EXISTS auto_lock_system_booking_trigger ON system_bookings;
CREATE TRIGGER auto_lock_system_booking_trigger
AFTER INSERT OR UPDATE ON system_bookings
FOR EACH ROW EXECUTE FUNCTION trigger_auto_lock_on_booking_change();

DROP TRIGGER IF EXISTS auto_lock_subsystem_booking_trigger ON subsystem_bookings;
CREATE TRIGGER auto_lock_subsystem_booking_trigger
AFTER INSERT OR UPDATE ON subsystem_bookings
FOR EACH ROW EXECUTE FUNCTION trigger_auto_lock_on_booking_change();