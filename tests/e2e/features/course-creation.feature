Feature: Course Creation

  Background:
    Given I am logged in as "admin@test.com" with password "123456"
    And I am on the courses page

  Scenario: Create a new course
    When I click the "Create Course" button
    And the course creation modal opens
    And I click the "Next" button
    And I fill in the course title "Test Course"
    And I fill in the course description "A test description for the course"
    And I submit the course form
    Then I should see "Test Course" in the courses list
