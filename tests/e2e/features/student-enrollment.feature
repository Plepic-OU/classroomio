Feature: Student Enrollment

  Scenario: Student signs up to a course
    Given I am logged in as a student
    When I navigate to the LMS explore page
    And I click "Learn more" for the "Getting started with MVC" course
    And I click the "Enroll Now" button
    And I click the "Join Course" button
    Then I should be on the LMS page
