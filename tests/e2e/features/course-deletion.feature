Feature: Course Deletion

  Background:
    Given I am logged in as "admin@test.com" with password "123456"
    And I am on the org courses page

  Scenario: Admin deletes a course via the overflow menu
    When I hover over the course card for "Getting started with MVC"
    And I open the overflow menu on the "Getting started with MVC" card
    And I click the "Delete" option in the overflow menu
    Then the delete confirmation modal should appear
    When I confirm the deletion
    Then "Getting started with MVC" should no longer be visible on the page
