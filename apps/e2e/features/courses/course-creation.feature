Feature: Course Creation

  Background:
    Given I am logged in as admin

  Scenario: Admin creates a new course
    Given I am on the courses page
    When I click the create course button
    And I select the course type
    And I fill in the course name "Test Course"
    And I submit the course form
    Then I should see "Test Course" in the courses list
