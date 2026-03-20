Feature: Waitlist Enrollment

  Scenario: Student sees "Join Waitlist" when course is full and waitlist enabled
    Given I am logged in
    And there is a full course with waitlist enabled
    When I visit the invite link for the full course
    Then I should see the "Join Waitlist" button
    And I should see the course full waitlist message

  Scenario: Student joins waitlist successfully
    Given I am logged in
    And there is a full course with waitlist enabled
    When I visit the invite link for the full course
    And I click the "Join Waitlist" button
    Then I should see the waitlist confirmation message

  Scenario: Student sees "Course full" when waitlist is disabled
    Given I am logged in
    And there is a full course with waitlist disabled
    When I visit the invite link for the full course without waitlist
    Then I should see the course full message
    And I should not see any join button
