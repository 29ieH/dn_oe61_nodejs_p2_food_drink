import { AuthProvider } from 'apps/user-service/generated/prisma';

export class UserResponse {
  id: number;
  name: string;
  userName?: string;
  email?: string | null;
  providerName?: string;
  isActive?: boolean;
  imageUrl?: string;
  createdAt?: Date;
  updatedAt?: Date | null;
  deletedAt: Date | null;
  role: string;
  status: string;
  authProviders?: AuthProvider[];
}
