Feature: Course waitlist settings

  @waitlist
  Scenario: Admin enables waitlist for a course
    Given I am logged in as "admin@test.com"
    When I navigate to the course settings page
    And I set the max capacity to "5"
    And I enable the waitlist
    And I save the course settings
    Then the course should have max capacity 5 and waitlist enabled
