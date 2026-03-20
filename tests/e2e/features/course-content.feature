Feature: Course Content Management

  Background:
    Given I am logged in as a teacher

  Scenario: Teacher adds a lesson to a course
    Given I am on the content page for course "Getting started with MVC"
    When I click the "Add" button
    And I fill in the lesson title "Playwright Test Lesson"
    And I click the "Save" button
    Then I should be on the lesson page
