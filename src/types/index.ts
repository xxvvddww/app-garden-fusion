
export interface User {
  user_id: string;
  email: string;
  name: string;
  role: 'Admin' | 'Moderator' | 'User';
  status: 'Active' | 'Inactive' | 'Locked' | 'Suspended' | 'Pending' | 'Rejected';
  created_date?: string;
  updated_date?: string;
  created_by?: string;
  updated_by?: string;
  mobile_number?: string;
  tsa_id?: string;
}

export interface Bay {
  bay_id: string;
  bay_number: number; // Changed from string to number to match the database
  location: string;
  status: 'Available' | 'Reserved' | 'Maintenance';
  type?: string;
  created_date?: string;
  updated_date?: string;
  created_by?: string;
  updated_by?: string;
  reserved_by_you?: boolean;
  reserved_by?: string;
  is_permanent?: boolean;
}

export interface PermanentAssignment {
  assignment_id: string;
  user_id: string;
  bay_id: string;
  day_of_week: string;
  created_date?: string;
  created_by?: string;
  available_from?: string; // New field: start date for temporary availability
  available_to?: string;   // New field: end date for temporary availability
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

export const castToUser = (data: any): User => ({
  ...data,
  role: data.role as User['role'],
  status: data.status as User['status']
});

export const castToBay = (data: any): Bay => ({
  ...data,
  bay_number: Number(data.bay_number), // Ensure bay_number is cast to a number
  status: data.status as Bay['status'],
  reserved_by_you: data.reserved_by_you || false,
  reserved_by: data.reserved_by || undefined,
  is_permanent: data.is_permanent || false
});

export const castToDailyClaim = (data: any): DailyClaim => ({
  ...data,
  status: data.status as DailyClaim['status']
});

export const castToAnnouncement = (data: any): Announcement => ({
  ...data,
  status: data.status as Announcement['status']
});

export const castToPermanentAssignmentWithBay = (data: any): PermanentAssignment & { bay: Bay } => ({
  ...data,
  bay: castToBay(data.bay)
});
