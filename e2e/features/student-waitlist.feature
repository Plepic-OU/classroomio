Feature: Course Waitlist — Student Enrollment

  Background:
    Given I am logged in as a student

  # Scenarios 1-3 are intentionally sequential: the student joins Course A in scenario 2,
  # and leaves it in scenario 3. The DB state persists between scenarios within a run.

  Scenario: Student sees Join Waiting List CTA when course is at capacity
    When I navigate to the full course invite page
    And I attempt to join the full course
    Then I should see the course full message
    And I should see the join waitlist button

  Scenario: Student joins waitlist and sees confirmation
    When I navigate to the full course invite page
    And I attempt to join the full course
    And I click the join waitlist button
    Then I should see the waitlist confirmation message

  Scenario: Student leaves the waitlist
    When I navigate to the full course invite page
    Then I should see the leave waitlist button
    And I click the leave waitlist button
    Then I should see the join waitlist button

  Scenario: Student claims spot via valid token link
    When I navigate to the valid waitlist claim link
    Then I should be redirected to the LMS dashboard

  Scenario: Student visits an expired token claim link
    When I navigate to the expired waitlist claim link
    Then I should see the claim expired message
