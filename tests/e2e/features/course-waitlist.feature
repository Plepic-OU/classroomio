Feature: Course Waiting List

  Scenario: Settings page shows waitlist fields when waitlist is enabled
    Given there is a course with waitlist already enabled
    When I navigate to the settings page for that course
    Then the max capacity field should be visible

  Scenario: Student sees Join Waiting List button when course is full
    Given there is a published full waitlist course
    When I am on the join page for that course
    Then I should see the "Join Waiting List" button

  Scenario: Teacher sees Waiting List tab and approves a student
    Given there is a waitlist course with a waitlisted student
    When I navigate to the people page for that course
    And I click the Waiting List tab
    Then I should see the waiting list tab
    When I approve the first waitlisted student
    Then the waiting list should be empty
