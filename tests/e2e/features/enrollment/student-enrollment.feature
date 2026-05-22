Feature: Student Enrollment
  A student can enroll in a course via an invite link.

  @login-as-student
  Scenario: Student enrolls via invite link
    Given I follow the invite link for course "Getting started with MVC"
    When I click "Join Course"
    Then I should land on the student dashboard
