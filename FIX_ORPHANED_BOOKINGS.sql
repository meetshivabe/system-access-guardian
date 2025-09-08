-- ========================================
-- MANUAL FIX FOR ORPHANED BOOKING DATA
-- Run this SQL directly in Supabase SQL Editor to fix the issue
-- ========================================

-- Step 1: Clear booking fields from systems that don't have active bookings
UPDATE systems s
SET 
  booking_start = NULL,
  booking_end = NULL,
  is_locked = false,
  locked_by = NULL,
  locked_at = NULL
WHERE 
  (s.booking_start IS NOT NULL OR s.booking_end IS NOT NULL OR s.is_locked = true)
  AND NOT EXISTS (
    SELECT 1 
    FROM system_bookings sb 
    WHERE sb.system_id = s.id 
    AND sb.status = 'active'
    AND sb.booking_start <= NOW()
    AND sb.booking_end > NOW()
  );

-- Step 2: Clear booking fields from subsystems that don't have active bookings
UPDATE subsystems s
SET 
  booking_start = NULL,
  booking_end = NULL,
  is_locked = false,
  locked_by = NULL,
  locked_at = NULL
WHERE 
  (s.booking_start IS NOT NULL OR s.booking_end IS NOT NULL OR s.is_locked = true)
  AND NOT EXISTS (
    SELECT 1 
    FROM subsystem_bookings sb 
    WHERE sb.subsystem_id = s.id 
    AND sb.status = 'active'
    AND sb.booking_start <= NOW()
    AND sb.booking_end > NOW()
  );

-- Step 3: Update systems that have active bookings to ensure fields are correct
UPDATE systems s
SET 
  booking_start = sb.booking_start,
  booking_end = sb.booking_end,
  is_locked = true,
  locked_by = sb.user_id,
  locked_at = sb.booking_start
FROM system_bookings sb
WHERE 
  s.id = sb.system_id
  AND sb.status = 'active'
  AND sb.booking_start <= NOW()
  AND sb.booking_end > NOW();

-- Step 4: Update subsystems that have active bookings to ensure fields are correct
UPDATE subsystems s
SET 
  booking_start = sb.booking_start,
  booking_end = sb.booking_end,
  is_locked = true,
  locked_by = sb.user_id,
  locked_at = sb.booking_start
FROM subsystem_bookings sb
WHERE 
  s.id = sb.subsystem_id
  AND sb.status = 'active'
  AND sb.booking_start <= NOW()
  AND sb.booking_end > NOW();

-- Step 5: Mark expired bookings as completed
UPDATE system_bookings
SET status = 'completed'
WHERE status = 'active'
AND booking_end <= NOW();

UPDATE subsystem_bookings
SET status = 'completed'
WHERE status = 'active'
AND booking_end <= NOW();

-- Step 6: Show current state after cleanup
SELECT 
  'Systems with bookings' as type,
  s.name,
  s.is_locked,
  s.booking_start,
  s.booking_end,
  p.username as locked_by
FROM systems s
LEFT JOIN profiles p ON s.locked_by = p.id
WHERE s.booking_start IS NOT NULL OR s.is_locked = true
ORDER BY s.name;

-- ========================================
-- CLEANUP COMPLETE
-- This should fix any orphaned booking data
-- ========================================