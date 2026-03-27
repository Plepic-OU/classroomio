Feature: Student Enrollment

  Scenario: Student signs up to a course
    Given I am logged in as a student
    When I navigate to the LMS explore page
    And I click "Learn more" for the "Getting started with MVC" course
    And I click the "Enroll Now" button
    And I click the "Join Course" button
    Then I should be on the LMS page

  Scenario: Student joins waitlist when course is full
    Given I am logged in as a student with the waitlist reset for "Full Course with Waitlist"
    When I navigate to the LMS explore page
    And I click "Learn more" for the "Full Course with Waitlist" course
    And I click the "Enroll Now" button
    Then I should see a "Join Waitlist" button
    When I click the "Join Waitlist" button
    Then I should see the waitlist confirmation message
