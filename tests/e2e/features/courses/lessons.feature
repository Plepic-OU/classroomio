@p0 @needs-reset
Feature: Lessons

  Scenario: Add and delete a lesson within a course
    Given I have created a course named "BDD Lessons Test Course"
    And I am on the course lessons page
    When I add a section titled "BDD Section One"
    And I add a lesson titled "BDD Lesson One" to the section
    And I return to the lessons list
    Then I should see the lesson in the list
    When I delete the lesson
    Then the lesson should be removed from the list
