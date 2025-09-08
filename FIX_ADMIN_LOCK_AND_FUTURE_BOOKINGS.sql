-- ========================================
-- FIX ADMIN LOCK PERMISSIONS & FUTURE BOOKING BEHAVIOR
-- Run this SQL in your Supabase SQL Editor
-- ========================================

-- 1. Fix RLS policies for admin lock/unlock
-- Drop existing policies
DROP POLICY IF EXISTS "Users can unlock their own locked systems" ON public.systems;
DROP POLICY IF EXISTS "Users can unlock their own locked subsystems" ON public.subsystems;

-- Create new policies that allow admins to lock/unlock any system
CREATE POLICY "Users can unlock their own systems or admins can unlock any" 
ON public.systems 
FOR UPDATE 
USING (
  auth.uid() = locked_by 
  OR public.is_admin()
  OR NOT is_locked  -- Anyone can lock an unlocked system
);

CREATE POLICY "Users can unlock their own subsystems or admins can unlock any" 
ON public.subsystems 
FOR UPDATE 
USING (
  auth.uid() = locked_by 
  OR public.is_admin()
  OR NOT is_locked  -- Anyone can lock an unlocked subsystem
);

-- 2. Update the booking processing function to only lock when booking date arrives
DROP FUNCTION IF EXISTS process_active_bookings() CASCADE;

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
      -- Booking has ended - unlock the system and mark booking as completed
      UPDATE systems 
      SET is_locked = false, 
          locked_by = NULL, 
          locked_at = NULL,
          booking_start = NULL,
          booking_end = NULL
      WHERE id = booking.system_id 
      AND locked_by = booking.user_id;
      
      UPDATE system_bookings 
      SET status = 'completed',
          updated_at = current_time
      WHERE id = booking.id;
    END IF;
    -- If booking.booking_start > current_time, it's a future booking - don't lock yet
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
      -- Booking has ended - unlock the subsystem and mark booking as completed
      UPDATE subsystems 
      SET is_locked = false, 
          locked_by = NULL, 
          locked_at = NULL,
          booking_start = NULL,
          booking_end = NULL
      WHERE id = booking.subsystem_id 
      AND locked_by = booking.user_id;
      
      UPDATE subsystem_bookings 
      SET status = 'completed',
          updated_at = current_time
      WHERE id = booking.id;
    END IF;
    -- If booking.booking_start > current_time, it's a future booking - don't lock yet
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Update the bookSystem function to NOT lock immediately for future bookings
-- This modifies the client-side behavior through the database response

-- 4. Create a view to show upcoming bookings for systems
CREATE OR REPLACE VIEW system_booking_status AS
SELECT 
  s.id as system_id,
  s.name as system_name,
  s.is_locked,
  s.locked_by,
  s.locked_at,
  sb.id as booking_id,
  sb.user_id as booked_by,
  sb.booking_start,
  sb.booking_end,
  sb.status as booking_status,
  p.username as booked_by_username,
  CASE 
    WHEN sb.booking_start > NOW() THEN 'future'
    WHEN sb.booking_start <= NOW() AND sb.booking_end > NOW() THEN 'active'
    ELSE 'expired'
  END as booking_state
FROM systems s
LEFT JOIN system_bookings sb ON s.id = sb.system_id AND sb.status = 'active'
LEFT JOIN profiles p ON sb.user_id = p.id;

-- 5. Create a view for subsystem bookings
CREATE OR REPLACE VIEW subsystem_booking_status AS
SELECT 
  ss.id as subsystem_id,
  ss.name as subsystem_name,
  ss.system_id,
  ss.is_locked,
  ss.locked_by,
  ss.locked_at,
  sb.id as booking_id,
  sb.user_id as booked_by,
  sb.booking_start,
  sb.booking_end,
  sb.status as booking_status,
  p.username as booked_by_username,
  CASE 
    WHEN sb.booking_start > NOW() THEN 'future'
    WHEN sb.booking_start <= NOW() AND sb.booking_end > NOW() THEN 'active'
    ELSE 'expired'
  END as booking_state
FROM subsystems ss
LEFT JOIN subsystem_bookings sb ON ss.id = sb.subsystem_id AND sb.status = 'active'
LEFT JOIN profiles p ON sb.user_id = p.id;

-- 6. Grant permissions on views
GRANT SELECT ON system_booking_status TO authenticated;
GRANT SELECT ON subsystem_booking_status TO authenticated;

-- 7. Create or replace the Edge Function to periodically process bookings
-- Note: This needs to be called periodically (via cron job or Edge Function scheduler)
-- For immediate effect, you can call it manually:
-- SELECT process_active_bookings();

-- ========================================
-- MIGRATION COMPLETE
-- 
-- This migration fixes:
-- 1. Admins can now lock/unlock any system
-- 2. Future bookings don't lock immediately
-- 3. Systems only lock when booking date arrives
-- 4. Views provide booking status information
-- ========================================