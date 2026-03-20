Feature: Add Lesson to Course

  Scenario: Add a new lesson to an existing course
    Given I am on the lessons page for course "98e6e798-f0bd-4f9d-a6f5-ce0816a4f97e"
    When I click the add lesson button
    And I fill in the lesson title "Introduction to MVC Basics"
    And I save the lesson
    Then I should see the lesson "Introduction to MVC Basics" in the content list
