Feature: Course Waitlist

  @unauthenticated
  Scenario: Student sees waitlist option when course is full
    Given I am logged in as a student
    When I navigate to the student invite link for course "Modern Web Development with React"
    Then I should see "This course is currently full"
    And I should see a "Join Waiting List" button
