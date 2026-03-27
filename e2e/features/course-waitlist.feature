Feature: Course Waitlist — Admin Management

  Background:
    Given I am logged in as an admin

  Scenario: Admin views waitlist section in Course People tab
    When I navigate to the waitlisted course people page
    Then I should see the waitlist section with 1 student

  Scenario: Admin removes a student from the waitlist
    When I navigate to the waitlisted course people page
    And I remove the first student from the waitlist
    Then the waitlist section should be empty
