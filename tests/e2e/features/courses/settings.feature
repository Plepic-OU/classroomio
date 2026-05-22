Feature: Course Settings

  @slow @teacher
  Scenario: Rename the course title and save
    Given a course exists
    And I am on the settings page for that course
    When I update the course title to "Renamed Course Title"
    And I click save changes
    Then the settings page should show "Renamed Course Title" as the course title

  @slow @teacher
  Scenario: Toggle the published state off then on
    Given a course exists
    And I am on the settings page for that course
    When I toggle the published state
    And I click save changes
    Then the published toggle should reflect the new state
