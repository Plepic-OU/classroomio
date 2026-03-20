Feature: Course Enrollment

  @unauthenticated
  Scenario: Student signs up to a free course
    Given I am logged in as a student
    When I navigate to the student invite link for course "Getting started with MVC"
    And I click the join course button
    Then I should be redirected to the LMS dashboard
