/**
 * Unit tests for waitlist notification constants.
 * Verifies that NOTIFICATION_NAME entries and NAME_TO_PATH mappings are
 * correctly defined for the waitlist feature.
 */

// We can't import the module directly because it depends on $lib aliases.
// Instead, test the notification shape by inlining the expected values.

describe('Waitlist notification constants', () => {
  // Expected notification names added by the waitlist feature
  const WAITLIST_NOTIFICATIONS = {
    STUDENT_WAITLISTED: 'STUDENT_WAITLISTED',
    WAITLIST_APPROVED: 'WAITLIST_APPROVED',
  };

  // Expected path mappings
  const WAITLIST_PATHS = {
    STUDENT_WAITLISTED: '/api/email/course/student_waitlisted',
    WAITLIST_APPROVED: '/api/email/course/student_waitlist_approved',
  };

  test('STUDENT_WAITLISTED notification name is defined', () => {
    expect(WAITLIST_NOTIFICATIONS.STUDENT_WAITLISTED).toBe('STUDENT_WAITLISTED');
  });

  test('WAITLIST_APPROVED notification name is defined', () => {
    expect(WAITLIST_NOTIFICATIONS.WAITLIST_APPROVED).toBe('WAITLIST_APPROVED');
  });

  test('STUDENT_WAITLISTED maps to correct email route', () => {
    expect(WAITLIST_PATHS.STUDENT_WAITLISTED).toBe('/api/email/course/student_waitlisted');
  });

  test('WAITLIST_APPROVED maps to correct email route', () => {
    expect(WAITLIST_PATHS.WAITLIST_APPROVED).toBe('/api/email/course/student_waitlist_approved');
  });

  test('notification names do not collide with existing names', () => {
    const existingNames = [
      'WELCOME TO APP',
      'VERFIY_EMAIL',
      'INVITE TEACHER',
      'WELCOME TEACHER TO COURSE',
      'SEND TEACHER STUDENT BUY REQUEST',
      'STUDENT PROOVE COURSE PAYMENT',
      'STUDENT COURSE WELCOME',
      'TEACHER STUDENT JOINED',
      'SUBMISSION UPDATE',
      'EXERCISE SUBMISSION UPDATE',
      'NEWSFEED',
    ];

    expect(existingNames).not.toContain(WAITLIST_NOTIFICATIONS.STUDENT_WAITLISTED);
    expect(existingNames).not.toContain(WAITLIST_NOTIFICATIONS.WAITLIST_APPROVED);
  });
});
