Feature: Lesson Creation

  Scenario: Teacher adds a lesson to a course
    Given I am on the lessons page for a course I teach
    When I add a lesson titled "[TEST] My First Lesson"
    Then I should be taken to the lesson editor
