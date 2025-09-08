-- ========================================
-- FIX BOOKING CONFLICTS - ADMIN OVERRIDE
-- Run this SQL in your Supabase SQL Editor
-- ========================================

-- Drop existing triggers first
DROP TRIGGER IF EXISTS prevent_system_booking_overlap ON system_bookings;
DROP TRIGGER IF EXISTS prevent_subsystem_booking_overlap ON subsystem_bookings;
DROP FUNCTION IF EXISTS prevent_booking_overlap() CASCADE;

-- Create improved trigger function that allows admin overrides but prevents non-admin conflicts
CREATE OR REPLACE FUNCTION prevent_booking_overlap()
RETURNS TRIGGER AS $$
DECLARE
  user_is_admin BOOLEAN;
  has_conflict BOOLEAN;
  conflicting_user TEXT;
BEGIN
  -- Check if the user making the booking is an admin
  SELECT public.is_admin() INTO user_is_admin;
  
  -- For non-admin users, check for conflicts and block
  IF NOT user_is_admin THEN
    IF TG_TABLE_NAME = 'system_bookings' THEN
      -- Check for conflicts with other bookings
      SELECT EXISTS (
        SELECT 1 FROM system_bookings sb
        JOIN profiles p ON sb.user_id = p.id
        WHERE sb.system_id = NEW.system_id
        AND sb.status = 'active'
        AND sb.id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
        AND sb.user_id != NEW.user_id  -- Don't block user's own bookings
        AND (
          (sb.booking_start <= NEW.booking_start AND sb.booking_end > NEW.booking_start) OR
          (sb.booking_start < NEW.booking_end AND sb.booking_end >= NEW.booking_end) OR
          (sb.booking_start >= NEW.booking_start AND sb.booking_end <= NEW.booking_end)
        )
      ) INTO has_conflict;
      
      IF has_conflict THEN
        -- Get the username of the conflicting booking
        SELECT p.username INTO conflicting_user
        FROM system_bookings sb
        JOIN profiles p ON sb.user_id = p.id
        WHERE sb.system_id = NEW.system_id
        AND sb.status = 'active'
        AND sb.id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
        AND sb.user_id != NEW.user_id
        AND (
          (sb.booking_start <= NEW.booking_start AND sb.booking_end > NEW.booking_start) OR
          (sb.booking_start < NEW.booking_end AND sb.booking_end >= NEW.booking_end) OR
          (sb.booking_start >= NEW.booking_start AND sb.booking_end <= NEW.booking_end)
        )
        LIMIT 1;
        
        RAISE EXCEPTION 'This system is already booked by % for the selected time period. Only admins can override existing bookings.', conflicting_user;
      END IF;
      
    ELSIF TG_TABLE_NAME = 'subsystem_bookings' THEN
      -- Check for conflicts with other bookings
      SELECT EXISTS (
        SELECT 1 FROM subsystem_bookings sb
        JOIN profiles p ON sb.user_id = p.id
        WHERE sb.subsystem_id = NEW.subsystem_id
        AND sb.status = 'active'
        AND sb.id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
        AND sb.user_id != NEW.user_id  -- Don't block user's own bookings
        AND (
          (sb.booking_start <= NEW.booking_start AND sb.booking_end > NEW.booking_start) OR
          (sb.booking_start < NEW.booking_end AND sb.booking_end >= NEW.booking_end) OR
          (sb.booking_start >= NEW.booking_start AND sb.booking_end <= NEW.booking_end)
        )
      ) INTO has_conflict;
      
      IF has_conflict THEN
        -- Get the username of the conflicting booking
        SELECT p.username INTO conflicting_user
        FROM subsystem_bookings sb
        JOIN profiles p ON sb.user_id = p.id
        WHERE sb.subsystem_id = NEW.subsystem_id
        AND sb.status = 'active'
        AND sb.id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
        AND sb.user_id != NEW.user_id
        AND (
          (sb.booking_start <= NEW.booking_start AND sb.booking_end > NEW.booking_start) OR
          (sb.booking_start < NEW.booking_end AND sb.booking_end >= NEW.booking_end) OR
          (sb.booking_start >= NEW.booking_start AND sb.booking_end <= NEW.booking_end)
        )
        LIMIT 1;
        
        RAISE EXCEPTION 'This subsystem is already booked by % for the selected time period. Only admins can override existing bookings.', conflicting_user;
      END IF;
    END IF;
    
  ELSE
    -- Admin user - allow override and cancel conflicting bookings
    IF TG_OP = 'INSERT' THEN
      IF TG_TABLE_NAME = 'system_bookings' THEN
        -- Cancel conflicting bookings from other users
        UPDATE system_bookings 
        SET status = 'cancelled',
            updated_at = NOW()
        WHERE system_id = NEW.system_id
        AND id != NEW.id
        AND user_id != NEW.user_id  -- Don't cancel admin's own bookings
        AND status = 'active'
        AND (
          (booking_start <= NEW.booking_start AND booking_end > NEW.booking_start) OR
          (booking_start < NEW.booking_end AND booking_end >= NEW.booking_end) OR
          (booking_start >= NEW.booking_start AND booking_end <= NEW.booking_end)
        );
        
      ELSIF TG_TABLE_NAME = 'subsystem_bookings' THEN
        -- Cancel conflicting bookings from other users
        UPDATE subsystem_bookings 
        SET status = 'cancelled',
            updated_at = NOW()
        WHERE subsystem_id = NEW.subsystem_id
        AND id != NEW.id
        AND user_id != NEW.user_id  -- Don't cancel admin's own bookings
        AND status = 'active'
        AND (
          (booking_start <= NEW.booking_start AND booking_end > NEW.booking_start) OR
          (booking_start < NEW.booking_end AND booking_end >= NEW.booking_end) OR
          (booking_start >= NEW.booking_start AND booking_end <= NEW.booking_end)
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers with the new function
CREATE TRIGGER prevent_system_booking_overlap
BEFORE INSERT OR UPDATE ON system_bookings
FOR EACH ROW EXECUTE FUNCTION prevent_booking_overlap();

CREATE TRIGGER prevent_subsystem_booking_overlap
BEFORE INSERT OR UPDATE ON subsystem_bookings
FOR EACH ROW EXECUTE FUNCTION prevent_booking_overlap();

-- Add helper function to check if current user is admin (if not exists)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ========================================
-- MIGRATION COMPLETE
-- 
-- This migration ensures:
-- 1. Non-admin users CANNOT override existing bookings
-- 2. Admin users CAN override bookings (conflicting bookings are cancelled)
-- 3. Users get clear error messages about who has the conflicting booking
-- ========================================