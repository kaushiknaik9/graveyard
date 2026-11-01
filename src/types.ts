export type Severity = 'Low' | 'Medium' | 'Severe';
export type ReportStatus = 'Pending' | 'Acknowledged' | 'In Progress' | 'Repaired';

export interface Report {
  id: string;
  user_id: string | null;
  user_name: string;
  image_url: string;
  latitude: number;
  longitude: number;
  accuracy_meters: number | null;
  severity: Severity;
  ai_confidence: number;
  ai_reasoning: string;
  status: ReportStatus;
  upvotes: number;
  created_at: string;
  note?: string;
  
  // Real Geospatial & Ward Routing fields
  address?: string;
  ward?: string;
  assigned_zone?: string;
  assigned_office?: string;
  estimated_diameter_cm?: number;

  // Resolution & SLA Tracking fields
  acknowledged_at?: string;
  dispatched_at?: string;
  resolution_at?: string;
  resolution_note?: string;
  resolution_image_url?: string;
  resolution_officer?: string;
}

export type Pothole = Report;

export interface VerifyResponse {
  is_pothole: boolean;
  severity: Severity;
  confidence: number;
  reasoning: string;
  estimated_diameter_cm?: number;
  hazard_type?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  role: 'citizen' | 'gov';
  user_name?: string;
}

export interface WardJurisdiction {
  zoneId: string;
  zoneName: string;
  wardNumber: number;
  wardName: string;
  officeName: string;
  officeAddress: string;
  engineerInCharge: string;
  hotline: string;
  latitude: number;
  longitude: number;
  distanceKm?: number;
}
