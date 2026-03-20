Feature: Course Publishing

  Scenario: Teacher publishes a draft course
    Given I am on the settings page for an unpublished test course
    When I toggle the course to published and save
    Then the course should show as published
