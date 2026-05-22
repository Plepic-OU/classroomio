@p0 @needs-reset
Feature: Exercise authoring

  Scenario: Add radio, checkbox, and paragraph questions to a lesson exercise
    Given I have created a course named "BDD Exercise Course"
    And I am on the course lessons page
    When I add a section titled "BDD Exercise Section"
    And I add a lesson titled "BDD Exercise Lesson" to the section
    And I open the lesson exercises
    When I click the add exercise button
    And I choose to start from scratch
    And I enter the exercise title "BDD Test Exercise"
    And I finish creating the exercise
    Then I should be on the exercise editor page
    When I fill in the last question with text "What is the capital of France?"
    And I add a new question
    And I fill in the last question with text "Select all prime numbers"
    And I set the last question type to "Multiple answers"
    And I add a new question
    And I fill in the last question with text "Describe the water cycle"
    And I set the last question type to "Paragraph"
    And I save the exercise
    Then I should see the exercise "BDD Test Exercise" in the exercises list
