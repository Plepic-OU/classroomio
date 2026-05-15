Feature: Course Edit

  Background:
    Given I am logged in as "admin@test.com"
    And I have a new course named "BDD Edit Course"

  @write
  Scenario: Teacher can update the course title in settings
    Given I navigate to the "settings" tab of this course
    When I clear and fill the course title field with "BDD Renamed Course"
    And I click save changes
    Then I should see "BDD Renamed Course" on the page
