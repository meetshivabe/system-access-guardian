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