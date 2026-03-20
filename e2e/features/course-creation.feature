Feature: Course Creation

  Background:
    Given I am logged in as an instructor

  Scenario: Create a new course with title and description
    Given I am on the courses page
    When I click the create course button
    And I enter course title "BDD Test Course"
    And I enter course description "A test course created by BDD tests"
    And I submit the course form
    Then I should be on the new course page

  Scenario: Cannot create a course without a title
    Given I am on the courses page
    When I click the create course button
    And I submit the course form without a title
    Then I should see a validation error
