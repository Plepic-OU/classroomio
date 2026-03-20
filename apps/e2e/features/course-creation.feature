Feature: Course Creation

  Background:
    Given I am logged in as an admin

  Scenario: Create a new course
    Given I am on the org courses page
    When I click "Create Course"
    And I select course type "Live Class"
    And I click "Next"
    And I fill in the course name "Test Course"
    And I fill in the course description "Test Description"
    And I submit the form
    Then I should be on the new course detail page
