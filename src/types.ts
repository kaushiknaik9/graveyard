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
}

export type Pothole = Report;

export interface VerifyResponse {
  is_pothole: boolean;
  severity: Severity;
  confidence: number;
  reasoning: string;
}

export interface UserProfile {
  id: string;
  email: string;
  role: 'citizen' | 'gov';
  user_name?: string;
}
