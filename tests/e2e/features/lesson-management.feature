Feature: Lesson Management

  Background:
    Given I am logged in as "admin@test.com" with password "123456"

  Scenario: Admin adds a lesson to a course
    Given I am on the lessons page for course "Modern Web Development with React"
    When I click the "Add" button
    Then the add lesson modal should open
    When I fill in the lesson title "Introduction to React Hooks"
    And I save the lesson
    Then I should be navigated to the new lesson page
