
export interface User {
  user_id: string;
  email: string;
  name: string;
  role: 'Admin' | 'Moderator' | 'User';
  status: 'Active' | 'Inactive' | 'Locked' | 'Suspended';
  created_date?: string;
  updated_date?: string;
  created_by?: string;
  updated_by?: string;
  mobile_number?: string;
  tsa_id?: string;
}

export interface Bay {
  bay_id: string;
  bay_number: string;
  location: string;
  status: 'Available' | 'Reserved' | 'Maintenance';
  type?: string;
  created_date?: string;
  updated_date?: string;
  created_by?: string;
  updated_by?: string;
}

export interface PermanentAssignment {
  assignment_id: string;
  user_id: string;
  bay_id: string;
  day_of_week: string;
  created_date?: string;
  created_by?: string;
}

export interface DailyClaim {
  claim_id: string;
  user_id: string;
  bay_id: string;
  claim_date: string;
  status: 'Active' | 'Cancelled';
  created_date?: string;
  created_by?: string;
}

export interface Announcement {
  announcement_id: string;
  title: string;
  content: string;
  status: 'Active' | 'Archived';
  created_by: string;
  created_time: string;
}
