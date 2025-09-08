-- Add booking columns to systems table
ALTER TABLE public.systems 
ADD COLUMN IF NOT EXISTS booking_start TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS booking_end TIMESTAMP WITH TIME ZONE;

-- Add booking columns to subsystems table  
ALTER TABLE public.subsystems
ADD COLUMN IF NOT EXISTS booking_start TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS booking_end TIMESTAMP WITH TIME ZONE;

-- Create bookings table for future bookings
CREATE TABLE public.system_bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  system_id UUID NOT NULL REFERENCES public.systems(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  booking_start TIMESTAMP WITH TIME ZONE NOT NULL,
  booking_end TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT booking_duration_limit CHECK (
    booking_end - booking_start <= INTERVAL '2 days'
  ),
  CONSTRAINT booking_time_order CHECK (
    booking_end > booking_start
  )
);

-- Create subsystem bookings table
CREATE TABLE public.subsystem_bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subsystem_id UUID NOT NULL REFERENCES public.subsystems(id) ON DELETE CASCADE,
  system_id UUID NOT NULL REFERENCES public.systems(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  booking_start TIMESTAMP WITH TIME ZONE NOT NULL,
  booking_end TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT subsystem_booking_duration_limit CHECK (
    booking_end - booking_start <= INTERVAL '2 days'
  ),
  CONSTRAINT subsystem_booking_time_order CHECK (
    booking_end > booking_start
  )
);

-- Enable RLS
ALTER TABLE public.system_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subsystem_bookings ENABLE ROW LEVEL SECURITY;

-- RLS policies for system_bookings
CREATE POLICY "Users can view all bookings" 
ON public.system_bookings 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can create bookings" 
ON public.system_bookings 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own bookings" 
ON public.system_bookings 
FOR UPDATE 
USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Users can delete their own bookings" 
ON public.system_bookings 
FOR DELETE 
USING (auth.uid() = user_id OR public.is_admin());

-- RLS policies for subsystem_bookings
CREATE POLICY "Users can view all subsystem bookings" 
ON public.subsystem_bookings 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can create subsystem bookings" 
ON public.subsystem_bookings 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own subsystem bookings" 
ON public.subsystem_bookings 
FOR UPDATE 
USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Users can delete their own subsystem bookings" 
ON public.subsystem_bookings 
FOR DELETE 
USING (auth.uid() = user_id OR public.is_admin());

-- Create function to check booking conflicts
CREATE OR REPLACE FUNCTION check_booking_conflicts(
  p_system_id UUID,
  p_start TIMESTAMP WITH TIME ZONE,
  p_end TIMESTAMP WITH TIME ZONE,
  p_exclude_booking_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM system_bookings
    WHERE system_id = p_system_id
    AND status = 'active'
    AND (p_exclude_booking_id IS NULL OR id != p_exclude_booking_id)
    AND (
      (booking_start <= p_start AND booking_end > p_start) OR
      (booking_start < p_end AND booking_end >= p_end) OR
      (booking_start >= p_start AND booking_end <= p_end)
    )
  );
END;
$$ LANGUAGE plpgsql;

-- Create function to check subsystem booking conflicts
CREATE OR REPLACE FUNCTION check_subsystem_booking_conflicts(
  p_subsystem_id UUID,
  p_start TIMESTAMP WITH TIME ZONE,
  p_end TIMESTAMP WITH TIME ZONE,
  p_exclude_booking_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM subsystem_bookings
    WHERE subsystem_id = p_subsystem_id
    AND status = 'active'
    AND (p_exclude_booking_id IS NULL OR id != p_exclude_booking_id)
    AND (
      (booking_start <= p_start AND booking_end > p_start) OR
      (booking_start < p_end AND booking_end >= p_end) OR
      (booking_start >= p_start AND booking_end <= p_end)
    )
  );
END;
$$ LANGUAGE plpgsql;

-- Create trigger to prevent overlapping bookings
CREATE OR REPLACE FUNCTION prevent_booking_overlap()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_TABLE_NAME = 'system_bookings' THEN
    IF check_booking_conflicts(NEW.system_id, NEW.booking_start, NEW.booking_end, NEW.id) THEN
      RAISE EXCEPTION 'Booking conflicts with existing reservation';
    END IF;
  ELSIF TG_TABLE_NAME = 'subsystem_bookings' THEN
    IF check_subsystem_booking_conflicts(NEW.subsystem_id, NEW.booking_start, NEW.booking_end, NEW.id) THEN
      RAISE EXCEPTION 'Booking conflicts with existing reservation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_system_booking_overlap
BEFORE INSERT OR UPDATE ON system_bookings
FOR EACH ROW EXECUTE FUNCTION prevent_booking_overlap();

CREATE TRIGGER prevent_subsystem_booking_overlap
BEFORE INSERT OR UPDATE ON subsystem_bookings
FOR EACH ROW EXECUTE FUNCTION prevent_booking_overlap();

-- Create function to automatically lock/unlock based on bookings
CREATE OR REPLACE FUNCTION process_active_bookings()
RETURNS void AS $$
DECLARE
  booking RECORD;
  current_time TIMESTAMP WITH TIME ZONE := NOW();
BEGIN
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
      WHERE id = booking.system_id 
      AND (is_locked = false OR locked_by != booking.user_id);
    ELSIF booking.booking_end <= current_time THEN
      -- Unlock the system and mark booking as completed
      UPDATE systems 
      SET is_locked = false, 
          locked_by = NULL, 
          locked_at = NULL,
          booking_start = NULL,
          booking_end = NULL
      WHERE id = booking.system_id 
      AND locked_by = booking.user_id;
      
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
      WHERE id = booking.subsystem_id 
      AND (is_locked = false OR locked_by != booking.user_id);
    ELSIF booking.booking_end <= current_time THEN
      -- Unlock the subsystem and mark booking as completed
      UPDATE subsystems 
      SET is_locked = false, 
          locked_by = NULL, 
          locked_at = NULL,
          booking_start = NULL,
          booking_end = NULL
      WHERE id = booking.subsystem_id 
      AND locked_by = booking.user_id;
      
      UPDATE subsystem_bookings 
      SET status = 'completed' 
      WHERE id = booking.id;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create indexes for better performance
CREATE INDEX idx_system_bookings_system_id ON public.system_bookings(system_id);
CREATE INDEX idx_system_bookings_user_id ON public.system_bookings(user_id);
CREATE INDEX idx_system_bookings_status ON public.system_bookings(status);
CREATE INDEX idx_system_bookings_times ON public.system_bookings(booking_start, booking_end);

CREATE INDEX idx_subsystem_bookings_subsystem_id ON public.subsystem_bookings(subsystem_id);
CREATE INDEX idx_subsystem_bookings_system_id ON public.subsystem_bookings(system_id);
CREATE INDEX idx_subsystem_bookings_user_id ON public.subsystem_bookings(user_id);
CREATE INDEX idx_subsystem_bookings_status ON public.subsystem_bookings(status);
CREATE INDEX idx_subsystem_bookings_times ON public.subsystem_bookings(booking_start, booking_end);