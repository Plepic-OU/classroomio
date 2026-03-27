Feature: Student Course Enrollment

  Background:
    Given I am logged in as a student

  Scenario: Student enrolls in a published course
    When I navigate to the course explore page
    And I click on the "E2E Seed Course" course card
    And I click the "Enroll Now" button
    And I click the "Join Course" button
    Then I should be redirected to the LMS dashboard

  Scenario: Student sees pre-enrolled course in My Learning
    When I navigate to My Learning
    Then I should see "E2E My Learning Course" in my learning list
