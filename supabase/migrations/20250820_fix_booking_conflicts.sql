-- Drop existing triggers
DROP TRIGGER IF EXISTS prevent_system_booking_overlap ON system_bookings;
DROP TRIGGER IF EXISTS prevent_subsystem_booking_overlap ON subsystem_bookings;
DROP FUNCTION IF EXISTS prevent_booking_overlap();

-- Create improved trigger function that allows admin overrides but prevents non-admin conflicts
CREATE OR REPLACE FUNCTION prevent_booking_overlap()
RETURNS TRIGGER AS $$
DECLARE
  user_is_admin BOOLEAN;
  has_conflict BOOLEAN;
BEGIN
  -- Check if the user making the booking is an admin
  SELECT public.is_admin() INTO user_is_admin;
  
  -- Admins can override any booking
  IF user_is_admin THEN
    -- When admin creates a booking, cancel conflicting bookings
    IF TG_OP = 'INSERT' THEN
      IF TG_TABLE_NAME = 'system_bookings' THEN
        -- Cancel conflicting bookings
        UPDATE system_bookings 
        SET status = 'cancelled',
            updated_at = NOW()
        WHERE system_id = NEW.system_id
        AND id != NEW.id
        AND status = 'active'
        AND (
          (booking_start <= NEW.booking_start AND booking_end > NEW.booking_start) OR
          (booking_start < NEW.booking_end AND booking_end >= NEW.booking_end) OR
          (booking_start >= NEW.booking_start AND booking_end <= NEW.booking_end)
        );
      ELSIF TG_TABLE_NAME = 'subsystem_bookings' THEN
        -- Cancel conflicting bookings
        UPDATE subsystem_bookings 
        SET status = 'cancelled',
            updated_at = NOW()
        WHERE subsystem_id = NEW.subsystem_id
        AND id != NEW.id
        AND status = 'active'
        AND (
          (booking_start <= NEW.booking_start AND booking_end > NEW.booking_start) OR
          (booking_start < NEW.booking_end AND booking_end >= NEW.booking_end) OR
          (booking_start >= NEW.booking_start AND booking_end <= NEW.booking_end)
        );
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  
  -- For non-admin users, check for conflicts
  IF TG_TABLE_NAME = 'system_bookings' THEN
    SELECT EXISTS (
      SELECT 1 FROM system_bookings
      WHERE system_id = NEW.system_id
      AND status = 'active'
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
      AND (
        (booking_start <= NEW.booking_start AND booking_end > NEW.booking_start) OR
        (booking_start < NEW.booking_end AND booking_end >= NEW.booking_end) OR
        (booking_start >= NEW.booking_start AND booking_end <= NEW.booking_end)
      )
    ) INTO has_conflict;
    
    IF has_conflict THEN
      RAISE EXCEPTION 'This system is already booked for the selected time period. Please choose different dates.';
    END IF;
  ELSIF TG_TABLE_NAME = 'subsystem_bookings' THEN
    SELECT EXISTS (
      SELECT 1 FROM subsystem_bookings
      WHERE subsystem_id = NEW.subsystem_id
      AND status = 'active'
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
      AND (
        (booking_start <= NEW.booking_start AND booking_end > NEW.booking_start) OR
        (booking_start < NEW.booking_end AND booking_end >= NEW.booking_end) OR
        (booking_start >= NEW.booking_start AND booking_end <= NEW.booking_end)
      )
    ) INTO has_conflict;
    
    IF has_conflict THEN
      RAISE EXCEPTION 'This subsystem is already booked for the selected time period. Please choose different dates.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers
CREATE TRIGGER prevent_system_booking_overlap
BEFORE INSERT OR UPDATE ON system_bookings
FOR EACH ROW EXECUTE FUNCTION prevent_booking_overlap();

CREATE TRIGGER prevent_subsystem_booking_overlap
BEFORE INSERT OR UPDATE ON subsystem_bookings
FOR EACH ROW EXECUTE FUNCTION prevent_booking_overlap();

-- Also add a unique constraint to prevent race conditions
-- This creates a constraint that prevents overlapping active bookings at the database level
CREATE OR REPLACE FUNCTION create_booking_exclusion_constraints() RETURNS void AS $$
BEGIN
  -- Try to create btree_gist extension if not exists
  CREATE EXTENSION IF NOT EXISTS btree_gist;
  
  -- Add exclusion constraint for system bookings
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'no_overlapping_system_bookings'
  ) THEN
    ALTER TABLE system_bookings
    ADD CONSTRAINT no_overlapping_system_bookings
    EXCLUDE USING gist (
      system_id WITH =,
      tstzrange(booking_start, booking_end) WITH &&
    ) WHERE (status = 'active');
  END IF;
  
  -- Add exclusion constraint for subsystem bookings
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'no_overlapping_subsystem_bookings'
  ) THEN
    ALTER TABLE subsystem_bookings
    ADD CONSTRAINT no_overlapping_subsystem_bookings
    EXCLUDE USING gist (
      subsystem_id WITH =,
      tstzrange(booking_start, booking_end) WITH &&
    ) WHERE (status = 'active');
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Execute the function to create constraints
SELECT create_booking_exclusion_constraints();

-- Drop the temporary function
DROP FUNCTION create_booking_exclusion_constraints();