@p0 @needs-reset
Feature: People

  Scenario: Generate student invite link and complete enrolment
    Given I have created a course named "Enrolment Test Course"
    And I am on the people invite page of that course
    When I copy the student invite link
    Then I should see the copied confirmation
    When a student opens the invite link and logs in as "student@test.com"
    Then the student should be enrolled and land on the LMS
