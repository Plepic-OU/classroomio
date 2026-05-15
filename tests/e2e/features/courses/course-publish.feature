Feature: Course Publish

  Background:
    Given I am logged in as "admin@test.com"
    And I have a new course named "BDD Publish Course"

  @write
  Scenario: Teacher can see the publish toggle on the settings page
    Given I navigate to the "settings" tab of this course
    Then I should see the publish toggle
    And the publish toggle should be in the unpublished state
