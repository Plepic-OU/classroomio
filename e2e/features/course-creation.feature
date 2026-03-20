Feature: Course Creation

  Background:
    Given I am logged in as "admin@test.com" with "123456"

  Scenario: Create a new course with title and description
    Given I am on the dashboard
    When I click the new course button
    And I select "Self Paced" as the course type
    And I click next
    And I fill in the course title with "BDD Test Course"
    And I fill in the course description with "Test course created by BDD"
    And I save the course
    Then I should see "BDD Test Course" in the course page
