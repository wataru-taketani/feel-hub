-- Add preferred_seats column to waitlist table
-- NULL = any seat (existing behavior), ['5','12','18'] = only these seats
ALTER TABLE waitlist ADD COLUMN preferred_seats text[] DEFAULT NULL;
