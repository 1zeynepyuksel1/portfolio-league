import { describe, it, expect, vi } from 'vitest';
import { resetUserPassword, UserNotFoundError, SameAsOldPasswordError } from './service.js';
import * as repository from './repository.js';
import argon2 from 'argon2';

vi.mock('./repository.js', () => ({
  findUserForLogin: vi.fn(),
  updateUserPassword: vi.fn(),
}));

vi.mock('argon2', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('hashed_password'),
    verify: vi.fn(),
  },
}));

describe('Password Reset Service Unit Tests', () => {
  it('should throw UserNotFoundError if email is not found', async () => {
    vi.mocked(repository.findUserForLogin).mockResolvedValueOnce(null);

    await expect(
      resetUserPassword({
        email: 'missing@example.com',
        password: 'newpassword123',
        confirmPassword: 'newpassword123',
      })
    ).rejects.toThrow(UserNotFoundError);
  });

  it('should throw SameAsOldPasswordError if the new password is same as old', async () => {
    const mockUser = {
      id: 'user-uuid',
      email: 'user@example.com',
      passwordHash: 'old_hashed_password',
      isEmailVerified: true,
      displayName: 'Test User',
      username: 'testuser',
    };

    vi.mocked(repository.findUserForLogin).mockResolvedValueOnce(mockUser);
    vi.mocked(argon2.verify).mockResolvedValueOnce(true); // Same!

    await expect(
      resetUserPassword({
        email: 'user@example.com',
        password: 'oldpassword123',
        confirmPassword: 'oldpassword123',
      })
    ).rejects.toThrow(SameAsOldPasswordError);

    expect(repository.findUserForLogin).toHaveBeenCalledWith('user@example.com');
    expect(argon2.verify).toHaveBeenCalledWith('old_hashed_password', 'oldpassword123');
  });

  it('should successfully hash and update password if email exists and password is different', async () => {
    const mockUser = {
      id: 'user-uuid',
      email: 'user@example.com',
      passwordHash: 'old_hashed_password',
      isEmailVerified: true,
      displayName: 'Test User',
      username: 'testuser',
    };

    vi.mocked(repository.findUserForLogin).mockResolvedValueOnce(mockUser);
    vi.mocked(argon2.verify).mockResolvedValueOnce(false); // Different!
    vi.mocked(repository.updateUserPassword).mockResolvedValueOnce({ id: 'user-uuid' });

    await resetUserPassword({
      email: 'user@example.com',
      password: 'newpassword123',
      confirmPassword: 'newpassword123',
    });

    expect(repository.findUserForLogin).toHaveBeenCalledWith('user@example.com');
    expect(argon2.verify).toHaveBeenCalledWith('old_hashed_password', 'newpassword123');
    expect(argon2.hash).toHaveBeenCalledWith('newpassword123');
    expect(repository.updateUserPassword).toHaveBeenCalledWith('user@example.com', 'hashed_password');
  });
});
