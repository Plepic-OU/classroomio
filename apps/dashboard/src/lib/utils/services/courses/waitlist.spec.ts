/**
 * Unit tests for course waitlist service functions.
 * Tests RPC wrappers and service layer edge cases per the design doc.
 */

// Mock supabase module before imports
const mockRpc = jest.fn();
const mockFrom = jest.fn();

jest.mock('$lib/utils/functions/supabase', () => ({
  supabase: {
    rpc: mockRpc,
    from: mockFrom
  },
  getAccessToken: jest.fn().mockResolvedValue('mock-token')
}));

// Mock svelte/store since waitlist.ts imports types from $lib/utils/types
// which indirectly requires writable etc in the module graph
jest.mock('svelte/store', () => ({
  get: jest.fn(() => false),
  writable: jest.fn(() => ({ subscribe: jest.fn(), set: jest.fn(), update: jest.fn() }))
}));

import {
  enrollOrWaitlist,
  approveWaitlistStudent,
  fetchWaitlistEntries,
  fetchStudentWaitlistPosition
} from './waitlist';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('enrollOrWaitlist', () => {
  it('returns enrolled when max_capacity is NULL (no cap)', async () => {
    mockRpc.mockResolvedValue({ data: 'enrolled', error: null });

    const { result, error } = await enrollOrWaitlist('course-1', 'profile-1');

    expect(mockRpc).toHaveBeenCalledWith('enroll_or_waitlist', {
      course_id_arg: 'course-1',
      profile_id_arg: 'profile-1'
    });
    expect(result).toBe('enrolled');
    expect(error).toBeNull();
  });

  it('returns enrolled when count < max_capacity', async () => {
    mockRpc.mockResolvedValue({ data: 'enrolled', error: null });

    const { result, error } = await enrollOrWaitlist('course-2', 'profile-2');

    expect(result).toBe('enrolled');
    expect(error).toBeNull();
  });

  it('returns waitlisted when count >= max_capacity', async () => {
    mockRpc.mockResolvedValue({ data: 'waitlisted', error: null });

    const { result, error } = await enrollOrWaitlist('course-full', 'profile-new');

    expect(result).toBe('waitlisted');
    expect(error).toBeNull();
  });

  it('handles RPC error gracefully', async () => {
    const rpcError = new Error('RPC failed');
    mockRpc.mockResolvedValue({ data: null, error: rpcError });

    const { result, error } = await enrollOrWaitlist('course-1', 'profile-1');

    expect(result).toBeNull();
    expect(error).toBe(rpcError);
  });
});

describe('approveWaitlistStudent', () => {
  it('returns approved student profile_id on success', async () => {
    mockRpc.mockResolvedValue({ data: 'profile-student-1', error: null });

    const { profileId, error } = await approveWaitlistStudent(42, 'profile-teacher');

    expect(mockRpc).toHaveBeenCalledWith('approve_waitlist_student', {
      waitlist_id_arg: 42,
      approved_by_profile_id_arg: 'profile-teacher'
    });
    expect(profileId).toBe('profile-student-1');
    expect(error).toBeNull();
  });

  it('enrolls regardless of current enrollment count (capacity override)', async () => {
    // The RPC always enrolls — approval always succeeds regardless of cap
    mockRpc.mockResolvedValue({ data: 'profile-student-over-cap', error: null });

    const { profileId, error } = await approveWaitlistStudent(1, 'teacher-id');

    expect(profileId).toBe('profile-student-over-cap');
    expect(error).toBeNull();
  });

  it('returns null profileId on error', async () => {
    const rpcError = new Error('Permission denied');
    mockRpc.mockResolvedValue({ data: null, error: rpcError });

    const { profileId, error } = await approveWaitlistStudent(99, 'bad-actor');

    expect(profileId).toBeNull();
    expect(error).toBe(rpcError);
  });
});

describe('fetchWaitlistEntries', () => {
  it('returns entries with profile data from RPC (FIFO)', async () => {
    const rpcRows = [
      { id: 1, course_id: 'c1', profile_id: 'p1', created_at: '2026-01-01T00:00:00Z', position: 1, fullname: 'Alice', avatar_url: null, email: 'alice@test.com' },
      { id: 2, course_id: 'c1', profile_id: 'p2', created_at: '2026-01-02T00:00:00Z', position: 2, fullname: 'Bob', avatar_url: null, email: 'bob@test.com' }
    ];
    mockRpc.mockResolvedValue({ data: rpcRows, error: null });

    const { data, error } = await fetchWaitlistEntries('c1');

    expect(mockRpc).toHaveBeenCalledWith('get_waitlist_entries', { course_id_arg: 'c1' });
    expect(data).toHaveLength(2);
    expect(data![0].position).toBe(1);
    expect(data![0].profile?.fullname).toBe('Alice');
    expect(data![1].position).toBe(2);
    expect(data![1].profile?.fullname).toBe('Bob');
    expect(error).toBeNull();
  });

  it('returns empty array when there are no waitlist entries', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });

    const { data, error } = await fetchWaitlistEntries('c1');

    expect(data).toHaveLength(0);
    expect(error).toBeNull();
  });

  it('returns null data on error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: new Error('DB error') });

    const { data, error } = await fetchWaitlistEntries('c1');

    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });
});

describe('fetchStudentWaitlistPosition', () => {
  const buildQueryChain = (returnValue: { data: unknown; error: unknown }) => {
    const chain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue(returnValue)
    };
    mockFrom.mockReturnValue(chain);
    return chain;
  };

  it('returns 1-based position when student is on waitlist', async () => {
    const entries = [
      { profile_id: 'p1', created_at: '2026-01-01T00:00:00Z' },
      { profile_id: 'p2', created_at: '2026-01-02T00:00:00Z' },
      { profile_id: 'p3', created_at: '2026-01-03T00:00:00Z' }
    ];
    buildQueryChain({ data: entries, error: null });

    const { position, error } = await fetchStudentWaitlistPosition('c1', 'p2');

    expect(position).toBe(2);
    expect(error).toBeNull();
  });

  it('returns null when student is not on waitlist', async () => {
    const entries = [
      { profile_id: 'p1', created_at: '2026-01-01T00:00:00Z' }
    ];
    buildQueryChain({ data: entries, error: null });

    const { position } = await fetchStudentWaitlistPosition('c1', 'p-not-here');

    expect(position).toBeNull();
  });

  it('returns null on DB error', async () => {
    buildQueryChain({ data: null, error: new Error('DB error') });

    const { position, error } = await fetchStudentWaitlistPosition('c1', 'p1');

    expect(position).toBeNull();
    expect(error).not.toBeNull();
  });

  it('returns position 1 when student is first in FIFO order', async () => {
    const entries = [
      { profile_id: 'p-first', created_at: '2026-01-01T00:00:00Z' },
      { profile_id: 'p-second', created_at: '2026-01-02T00:00:00Z' }
    ];
    buildQueryChain({ data: entries, error: null });

    const { position } = await fetchStudentWaitlistPosition('c1', 'p-first');

    expect(position).toBe(1);
  });
});
