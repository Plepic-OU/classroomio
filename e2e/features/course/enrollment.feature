Feature: Course Enrollment

  Scenario: Student enrolls in a free course via invite link
    Given I am logged in as "student@test.com" with password "123456"
    When I visit the invite link for course "Getting started with MVC"
    Then I should see the course name "Getting started with MVC"
    And I should see a "Join Course" button
    When I click the join course button
    Then I should be redirected to the LMS
