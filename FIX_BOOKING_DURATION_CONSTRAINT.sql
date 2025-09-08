-- ========================================
-- FIX BOOKING DURATION CONSTRAINT
-- Run this SQL in your Supabase SQL Editor
-- ========================================

-- Drop the existing constraints
ALTER TABLE public.system_bookings 
DROP CONSTRAINT IF EXISTS booking_duration_limit;

ALTER TABLE public.subsystem_bookings 
DROP CONSTRAINT IF EXISTS subsystem_booking_duration_limit;

-- Re-add the constraints with proper calculation
-- The constraint should allow bookings up to and including 3 days
-- because we use endOfDay for the end date (which adds up to 23:59:59)
ALTER TABLE public.system_bookings 
ADD CONSTRAINT booking_duration_limit CHECK (
  booking_end - booking_start <= INTERVAL '3 days'
);

ALTER TABLE public.subsystem_bookings 
ADD CONSTRAINT subsystem_booking_duration_limit CHECK (
  booking_end - booking_start <= INTERVAL '3 days'
);

-- ========================================
-- MIGRATION COMPLETE
-- 
-- This fixes the booking duration constraint to properly
-- handle endOfDay calculations
-- ========================================