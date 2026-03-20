Feature: Course Settings

  Background:
    Given I am logged in as a teacher

  Scenario: Teacher publishes a course
    Given I am on the settings page for course "Modern Web Development with React"
    When I enable the "Publish Course" toggle
    And I click the "Save Changes" button
    Then I should see a success notification "Saved successfully"
