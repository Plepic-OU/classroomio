/**
 * Unit tests for waitlist capacity evaluation logic.
 *
 * Tests the pure logic of capacity checking — the same conditions used
 * in getCourseCapacityInfo() and the invite page UI.
 */

interface CapacityResult {
  isFull: boolean;
  waitlistEnabled: boolean;
}

/**
 * Evaluates course capacity state — extracted logic from getCourseCapacityInfo.
 * This is the pure function under test.
 */
function evaluateCapacity(
  maxCapacity: number | null,
  waitlistEnabled: boolean,
  enrolledCount: number
): CapacityResult {
  if (!maxCapacity) return { isFull: false, waitlistEnabled: false };

  return {
    isFull: enrolledCount >= maxCapacity,
    waitlistEnabled,
  };
}

describe('Waitlist capacity evaluation', () => {
  describe('when max_capacity is null (unlimited)', () => {
    test('course is never full', () => {
      const result = evaluateCapacity(null, false, 100);
      expect(result.isFull).toBe(false);
    });

    test('waitlist is not enabled regardless of flag', () => {
      const result = evaluateCapacity(null, true, 100);
      expect(result.waitlistEnabled).toBe(false);
    });
  });

  describe('when course is under capacity', () => {
    test('course is not full when enrolled < capacity', () => {
      const result = evaluateCapacity(30, true, 15);
      expect(result.isFull).toBe(false);
    });

    test('waitlist state is preserved', () => {
      const result = evaluateCapacity(30, true, 15);
      expect(result.waitlistEnabled).toBe(true);
    });
  });

  describe('when course is at capacity', () => {
    test('course is full when enrolled === capacity', () => {
      const result = evaluateCapacity(30, true, 30);
      expect(result.isFull).toBe(true);
    });

    test('waitlist enabled flag is passed through', () => {
      const resultWithWaitlist = evaluateCapacity(30, true, 30);
      expect(resultWithWaitlist.waitlistEnabled).toBe(true);

      const resultWithoutWaitlist = evaluateCapacity(30, false, 30);
      expect(resultWithoutWaitlist.waitlistEnabled).toBe(false);
    });
  });

  describe('when course is over capacity', () => {
    test('course is full when enrolled > capacity', () => {
      const result = evaluateCapacity(10, true, 15);
      expect(result.isFull).toBe(true);
    });
  });

  describe('edge cases', () => {
    test('capacity of 1 with 1 enrolled is full', () => {
      const result = evaluateCapacity(1, true, 1);
      expect(result.isFull).toBe(true);
    });

    test('capacity of 1 with 0 enrolled is not full', () => {
      const result = evaluateCapacity(1, true, 0);
      expect(result.isFull).toBe(false);
    });

    test('zero enrolled count is never full', () => {
      const result = evaluateCapacity(100, false, 0);
      expect(result.isFull).toBe(false);
    });
  });
});

describe('Invite page UI state derivation', () => {
  /**
   * Derives the UI state for the invite page based on capacity.
   * Matches the conditional logic in +page.svelte.
   */
  function deriveInvitePageState(capacityChecked: boolean, isFull: boolean, waitlistEnabled: boolean) {
    if (!capacityChecked) return 'loading';
    if (isFull && !waitlistEnabled) return 'course-full';
    if (isFull && waitlistEnabled) return 'join-waitlist';
    return 'join-course';
  }

  test('shows loading state before capacity check', () => {
    expect(deriveInvitePageState(false, false, false)).toBe('loading');
  });

  test('shows "join course" when not full', () => {
    expect(deriveInvitePageState(true, false, false)).toBe('join-course');
  });

  test('shows "join waitlist" when full with waitlist enabled', () => {
    expect(deriveInvitePageState(true, true, true)).toBe('join-waitlist');
  });

  test('shows "course full" when full with waitlist disabled', () => {
    expect(deriveInvitePageState(true, true, false)).toBe('course-full');
  });

  test('shows "join course" when not full even with waitlist enabled', () => {
    expect(deriveInvitePageState(true, false, true)).toBe('join-course');
  });
});
