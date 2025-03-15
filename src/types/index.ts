
export type User = {
  user_id: string;
  name: string;
  email: string;
  mobile_number?: string;
  tsa_id?: string;
  role: 'Admin' | 'Moderator' | 'User';
  status: 'Active' | 'Archived' | 'Suspended' | 'Locked';
  created_by: string;
  created_date: string;
  last_login?: string;
  failed_login_attempts: number;
};

export type Bay = {
  bay_id: string;
  bay_number: string;
  type: 'Regular' | 'EV Charging';
  created_date: string;
};

export type PermanentAssignment = {
  assignment_id: string;
  bay_id: string;
  user_id: string;
  day_of_week: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
  created_by: string;
  created_date: string;
  reason: string;
};

export type DailyClaim = {
  claim_id: string;
  bay_id: string;
  user_id: string;
  claim_date: string;
  status: 'Active' | 'Cancelled';
  claim_time: string;
};

export type BayAvailability = {
  availability_id: string;
  bay_id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  created_time: string;
};

export type AuditLog = {
  log_id: string;
  user_id: string;
  action_type: string;
  description: string;
  target_id?: string;
  target_type?: string;
  timestamp: string;
  reason?: string;
};

export type Announcement = {
  announcement_id: string;
  admin_id: string;
  message: string;
  created_time: string;
  status: 'Active' | 'Archived';
};

export type AnnouncementReadStatus = {
  status_id: string;
  announcement_id: string;
  user_id: string;
  read_time: string;
};
