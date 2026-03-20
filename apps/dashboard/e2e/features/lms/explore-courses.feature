Feature: Explore Courses

  @unauthenticated
  Scenario: Student views available courses on explore page
    Given I am logged in as a student
    When I navigate to the explore page
    Then I should see available courses to enroll in
