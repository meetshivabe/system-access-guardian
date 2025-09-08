-- ========================================
-- ADD BOOKING LIMITS AND CONSTRAINTS
-- Run this SQL in your Supabase SQL Editor
-- ========================================

-- 1. Create function to check user's active booking count
CREATE OR REPLACE FUNCTION check_user_booking_limit()
RETURNS TRIGGER AS $$
DECLARE
  active_bookings_count INTEGER;
  user_is_admin BOOLEAN;
BEGIN
  -- Count user's active bookings (both systems and subsystems)
  SELECT COUNT(*) INTO active_bookings_count
  FROM (
    SELECT id FROM system_bookings 
    WHERE user_id = NEW.user_id 
    AND status = 'active'
    AND booking_end > NOW()
    
    UNION ALL
    
    SELECT id FROM subsystem_bookings 
    WHERE user_id = NEW.user_id 
    AND status = 'active'
    AND booking_end > NOW()
  ) AS all_bookings;
  
  -- Check if user has reached the limit (5 active future bookings)
  IF active_bookings_count >= 5 THEN
    RAISE EXCEPTION 'You have reached the maximum limit of 5 active bookings. Please wait for some bookings to complete or cancel existing ones.';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create triggers to enforce booking limits
DROP TRIGGER IF EXISTS check_system_booking_limit ON system_bookings;
CREATE TRIGGER check_system_booking_limit
BEFORE INSERT ON system_bookings
FOR EACH ROW EXECUTE FUNCTION check_user_booking_limit();

DROP TRIGGER IF EXISTS check_subsystem_booking_limit ON subsystem_bookings;
CREATE TRIGGER check_subsystem_booking_limit
BEFORE INSERT ON subsystem_bookings
FOR EACH ROW EXECUTE FUNCTION check_user_booking_limit();

-- 3. Create a view to get user's booking count
CREATE OR REPLACE VIEW user_booking_counts AS
SELECT 
  user_id,
  COUNT(*) as active_bookings,
  GREATEST(0, 5 - COUNT(*)) as remaining_bookings
FROM (
  SELECT user_id FROM system_bookings 
  WHERE status = 'active' 
  AND booking_end > NOW()
  
  UNION ALL
  
  SELECT user_id FROM subsystem_bookings 
  WHERE status = 'active'
  AND booking_end > NOW()
) AS all_bookings
GROUP BY user_id;

-- 4. Grant permissions
GRANT SELECT ON user_booking_counts TO authenticated;

-- 5. Create function to get user's remaining booking slots
CREATE OR REPLACE FUNCTION get_user_remaining_bookings(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  active_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO active_count
  FROM (
    SELECT id FROM system_bookings 
    WHERE user_id = p_user_id 
    AND status = 'active'
    AND booking_end > NOW()
    
    UNION ALL
    
    SELECT id FROM subsystem_bookings 
    WHERE user_id = p_user_id 
    AND status = 'active'
    AND booking_end > NOW()
  ) AS all_bookings;
  
  RETURN GREATEST(0, 5 - active_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_user_remaining_bookings(UUID) TO authenticated;

-- ========================================
-- MIGRATION COMPLETE
-- 
-- This migration adds:
-- 1. Maximum 5 active bookings per user (including admin)
-- 2. Triggers to enforce the limit
-- 3. Views and functions to check remaining booking slots
-- ========================================