Feature: Teacher approves waitlisted student

  @approve
  Scenario: Teacher approves a waitlisted student from the People tab
    Given I am logged in as "admin@test.com"
    When I navigate to the people tab of the course
    Then I should see the waitlist section
    When I click the approve button for the waitlisted student
    Then the student should be enrolled in the database
