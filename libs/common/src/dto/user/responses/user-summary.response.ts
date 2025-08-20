export class UserSummaryResponse {
  id: number;
  name: string;
  userName: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  isActive: boolean;
  imageUrl?: string | null;
  status: string;
  role: string;
}
