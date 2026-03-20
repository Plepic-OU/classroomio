Feature: Course Creation

  Background:
    Given I am logged in as a teacher

  Scenario: Teacher creates a new course
    When I navigate to the courses page
    And I click the "Create Course" button
    And I select a course type
    And I fill in the course name "Test Course"
    And I fill in the course description "A test course description"
    And I submit the form
    Then I should see "Test Course" on the page
