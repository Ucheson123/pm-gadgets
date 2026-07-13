// Mirror the DB enums exactly — no 'admin', it doesn't exist in Postgres
export type UserRole = 'salesperson' | 'manager';
export type UserStatus = 'pending' | 'active' | 'suspended';

export interface SessionUser {
  id: string;
  role: UserRole;
  status: UserStatus;
  full_name: string;
  branch_id: string | null; // column is nullable in the DB
  branch_name: string | null;
}

export interface SessionState {
  user: SessionUser | null;
}