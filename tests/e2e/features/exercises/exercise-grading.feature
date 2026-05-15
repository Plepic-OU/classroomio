Feature: Exercise and Grading

  Background:
    Given I am logged in as "admin@test.com"
    And I have a new course named "BDD Exercise Course"

  @write
  Scenario: Teacher can navigate to the exercises tab of a lesson
    Given I navigate to the "lessons" tab of this course
    And I click the add lesson button
    And I enter the lesson title "BDD Exercise Lesson"
    And I save the new lesson
    When I open the lesson "BDD Exercise Lesson"
    Then I should see the exercises tab
