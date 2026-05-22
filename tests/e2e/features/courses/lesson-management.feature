Feature: Lesson Management

  @smoke @skip
  Scenario: Add a lesson to a course
    Given a course exists
    And I am on the lessons page for that course
    When I click the add lesson button
    And I enter the lesson title "Test Lesson"
    And I save the new lesson
    Then "Test Lesson" should appear in the lesson list
