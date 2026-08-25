import { describe, it, expect, vi } from 'vitest';
import { resetUserPassword, UserNotFoundError } from './service.js';
import * as repository from './repository.js';
import argon2 from 'argon2';

vi.mock('./repository.js', () => ({
  findUserByEmail: vi.fn(),
  updateUserPassword: vi.fn(),
}));

vi.mock('argon2', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('hashed_password'),
  },
}));

describe('Password Reset Service Unit Tests', () => {
  it('should throw UserNotFoundError if email is not found', async () => {
    vi.mocked(repository.findUserByEmail).mockResolvedValueOnce(null);

    await expect(
      resetUserPassword({
        email: 'missing@example.com',
        password: 'newpassword123',
        confirmPassword: 'newpassword123',
      })
    ).rejects.toThrow(UserNotFoundError);
  });

  it('should successfully hash and update password if email exists', async () => {
    const mockUser = {
      id: 'user-uuid',
      email: 'user@example.com',
      displayName: 'Test User',
      isEmailVerified: true,
      createdAt: new Date(),
    };

    vi.mocked(repository.findUserByEmail).mockResolvedValueOnce(mockUser);
    vi.mocked(repository.updateUserPassword).mockResolvedValueOnce({ id: 'user-uuid' });

    await resetUserPassword({
      email: 'user@example.com',
      password: 'newpassword123',
      confirmPassword: 'newpassword123',
    });

    expect(repository.findUserByEmail).toHaveBeenCalledWith('user@example.com');
    expect(argon2.hash).toHaveBeenCalledWith('newpassword123');
    expect(repository.updateUserPassword).toHaveBeenCalledWith('user@example.com', 'hashed_password');
  });
});
