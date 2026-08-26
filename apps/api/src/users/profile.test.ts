import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getUserProfileByUsername } from './service.js';
import { db } from '../db/client.js';
import * as friendsRepo from '../friends/repository.js';
import * as leaguesRepo from '../leagues/repository.js';

vi.mock('../db/client.js', () => {
  const mockSelect = vi.fn();
  return {
    db: {
      select: mockSelect,
    },
  };
});

vi.mock('../friends/repository.js', () => ({
  findFriendshipBetweenUsers: vi.fn(),
}));

vi.mock('../leagues/repository.js', () => ({
  findCurrentOpenLeague: vi.fn(),
}));

describe('User Profile Service Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('kullanıcı bulunamazsa null dönmeli', async () => {
    const mockLimit = vi.fn().mockResolvedValueOnce([]);
    const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    vi.mocked(db.select).mockReturnValueOnce({ from: mockFrom } as any);

    const result = await getUserProfileByUsername('requester-id', 'nonexistent');
    expect(result).toBeNull();
  });

  it('gizli profil arkadaşı olmayan birine maskeli dönmeli', async () => {
    const mockUser = {
      id: 'target-id',
      username: 'gizliuye',
      firstName: 'Zeynep',
      lastName: 'Yüksel',
      isPublic: false,
      createdAt: new Date(),
    };

    // 1. Mock targetUser select
    const mockLimit1 = vi.fn().mockResolvedValueOnce([mockUser]);
    const mockWhere1 = vi.fn().mockReturnValue({ limit: mockLimit1 });
    const mockFrom1 = vi.fn().mockReturnValue({ where: mockWhere1 });

    // 2. Mock leagueEntries select
    const mockLimit2 = vi.fn().mockResolvedValueOnce([]);
    const mockWhere2 = vi.fn().mockReturnValue({ limit: mockLimit2 });
    const mockFrom2 = vi.fn().mockReturnValue({ where: mockWhere2 });

    vi.mocked(db.select)
      .mockReturnValueOnce({ from: mockFrom1 } as any)
      .mockReturnValueOnce({ from: mockFrom2 } as any);

    // Mock friendship: not friends
    vi.mocked(friendsRepo.findFriendshipBetweenUsers).mockResolvedValueOnce(undefined);

    // Mock current league
    vi.mocked(leaguesRepo.findCurrentOpenLeague).mockResolvedValueOnce({ id: 'league-id' } as any);

    const result = await getUserProfileByUsername('requester-id', 'gizliuye');

    expect(result).not.toBeNull();
    expect(result?.displayName).toBe('Z*** Y***');
    expect(result?.isSelf).toBe(false);
    expect(result?.areFriends).toBe(false);
  });

  it('gizli profil arkadaşı olan kişiye maskesiz dönmeli', async () => {
    const mockUser = {
      id: 'target-id',
      username: 'gizliuye',
      firstName: 'Zeynep',
      lastName: 'Yüksel',
      isPublic: false,
      createdAt: new Date(),
    };

    const mockLimit1 = vi.fn().mockResolvedValueOnce([mockUser]);
    const mockWhere1 = vi.fn().mockReturnValue({ limit: mockLimit1 });
    const mockFrom1 = vi.fn().mockReturnValue({ where: mockWhere1 });

    const mockLimit2 = vi.fn().mockResolvedValueOnce([]);
    const mockWhere2 = vi.fn().mockReturnValue({ limit: mockLimit2 });
    const mockFrom2 = vi.fn().mockReturnValue({ where: mockWhere2 });

    vi.mocked(db.select)
      .mockReturnValueOnce({ from: mockFrom1 } as any)
      .mockReturnValueOnce({ from: mockFrom2 } as any);

    // Mock friendship: accepted
    vi.mocked(friendsRepo.findFriendshipBetweenUsers).mockResolvedValueOnce({ status: 'accepted' } as any);

    vi.mocked(leaguesRepo.findCurrentOpenLeague).mockResolvedValueOnce({ id: 'league-id' } as any);

    const result = await getUserProfileByUsername('requester-id', 'gizliuye');

    expect(result).not.toBeNull();
    expect(result?.displayName).toBe('Zeynep Yüksel');
    expect(result?.areFriends).toBe(true);
  });
});
