export type UserRole = 'resident' | 'admin' | 'super_admin';
export type AccountStatus = 'pending' | 'approved' | 'suspended';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  unit_number: string;
  whatsapp: string;
  role: UserRole;
  status: AccountStatus;
  terms_accepted_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  sort_order: number;
  created_at: string;
}

export interface Product {
  id: string;
  seller_id: string;
  category_id: string;
  title: string;
  description: string;
  price_clp: number;
  image_url: string | null;
  images?: string[];
  is_available: boolean;
  is_hidden_by_admin: boolean;
  moderation_note: string | null;
  created_at: string;
  updated_at: string;
  seller?: Pick<Profile, 'id' | 'full_name' | 'unit_number' | 'whatsapp'>;
  category?: Pick<Category, 'id' | 'name' | 'icon'>;
}

export interface SupportContact {
  label: string;
  whatsapp: string;
}

export interface CondoSettings {
  id: number;
  condo_name: string;
  invite_code: string;
  admin_whatsapp?: string;
  support_contacts?: SupportContact[];
  open_access_until?: string | null;
  updated_at: string;
}

export interface InviteCode {
  id: string;
  code: string;
  label: string;
  max_uses: number | null;
  uses_count: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
}

export interface ModerationLog {
  id: string;
  admin_id: string;
  action: string;
  target_type: string;
  target_id: string;
  details: string | null;
  created_at: string;
}
