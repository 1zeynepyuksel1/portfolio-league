import { z } from 'zod';

export const registerBodySchema = z.object({
  email: z.string().email().trim().toLowerCase(),
  password: z.string().min(8).max(128),
  displayName: z.string().trim().min(2).max(50),
});

export type RegisterBody = z.infer<typeof registerBodySchema>;
