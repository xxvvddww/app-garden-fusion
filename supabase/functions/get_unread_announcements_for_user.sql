
-- Function to get unread announcements for a user
CREATE OR REPLACE FUNCTION get_unread_announcements_for_user(user_id_param UUID)
RETURNS SETOF announcements AS $$
BEGIN
  RETURN QUERY
  SELECT a.*
  FROM announcements a
  WHERE a.status = 'Active'
  AND NOT EXISTS (
    SELECT 1 FROM announcement_read_status ars
    WHERE ars.announcement_id = a.announcement_id
    AND ars.user_id = user_id_param
  )
  ORDER BY a.created_time DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
