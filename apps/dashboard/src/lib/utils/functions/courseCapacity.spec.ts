import { getCourseCapacityStatus } from './course';

// Mock the supabase client
jest.mock('./supabase', () => ({
  supabase: {
    from: jest.fn()
  }
}));

import { supabase } from './supabase';

const mockFrom = supabase.from as jest.Mock;

function mockSupabaseChain(overrides: { count?: number | null; waitlistData?: any } = {}) {
  const { count = 0, waitlistData = null } = overrides;

  mockFrom.mockImplementation((table: string) => {
    if (table === 'groupmember') {
      return {
        select: () => ({
          eq: () => ({
            eq: () => Promise.resolve({ count, error: null })
          })
        })
      };
    }
    if (table === 'course_waitlist') {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: waitlistData, error: null })
            })
          })
        })
      };
    }
    return {};
  });
}

describe('getCourseCapacityStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns no waitlist when max_capacity is null', async () => {
    const result = await getCourseCapacityStatus('course-1', 'group-1', null);
    expect(result).toEqual({
      isFull: false,
      hasWaitlist: false,
      enrolledCount: 0,
      maxCapacity: null,
      isOnWaitlist: false
    });
    // Should not query the database
    expect(mockFrom).not.toHaveBeenCalled();
  });

  test('returns not full when under capacity', async () => {
    mockSupabaseChain({ count: 5 });
    const result = await getCourseCapacityStatus('course-1', 'group-1', 10);
    expect(result.isFull).toBe(false);
    expect(result.hasWaitlist).toBe(true);
    expect(result.enrolledCount).toBe(5);
    expect(result.maxCapacity).toBe(10);
  });

  test('returns full when at capacity', async () => {
    mockSupabaseChain({ count: 10 });
    const result = await getCourseCapacityStatus('course-1', 'group-1', 10);
    expect(result.isFull).toBe(true);
    expect(result.enrolledCount).toBe(10);
  });

  test('returns full when over capacity', async () => {
    mockSupabaseChain({ count: 12 });
    const result = await getCourseCapacityStatus('course-1', 'group-1', 10);
    expect(result.isFull).toBe(true);
    expect(result.enrolledCount).toBe(12);
  });

  test('returns isOnWaitlist true when user is on waitlist', async () => {
    mockSupabaseChain({ count: 10, waitlistData: { id: 'wl-1' } });
    const result = await getCourseCapacityStatus('course-1', 'group-1', 10, 'user-1');
    expect(result.isOnWaitlist).toBe(true);
  });

  test('returns isOnWaitlist false when user is not on waitlist', async () => {
    mockSupabaseChain({ count: 10, waitlistData: null });
    const result = await getCourseCapacityStatus('course-1', 'group-1', 10, 'user-1');
    expect(result.isOnWaitlist).toBe(false);
  });

  test('skips waitlist check when no profileId provided', async () => {
    mockSupabaseChain({ count: 5 });
    const result = await getCourseCapacityStatus('course-1', 'group-1', 10);
    expect(result.isOnWaitlist).toBe(false);
    // Should only query groupmember, not course_waitlist
    expect(mockFrom).toHaveBeenCalledWith('groupmember');
    expect(mockFrom).not.toHaveBeenCalledWith('course_waitlist');
  });

  test('handles null count from supabase as zero', async () => {
    mockSupabaseChain({ count: null });
    const result = await getCourseCapacityStatus('course-1', 'group-1', 10);
    expect(result.isFull).toBe(false);
    expect(result.enrolledCount).toBe(0);
  });
});
