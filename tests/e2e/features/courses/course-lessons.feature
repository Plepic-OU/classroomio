Feature: Course Lessons

  Scenario: Teacher views the lessons page for a course
    Given I am logged in as "admin@test.com"
    When I navigate to the lessons page for the test course
    Then I should see the "Content" heading
    And I should see "BDD Test Lesson 1" in the lessons list

  Scenario: Teacher adds a new lesson to a course
    Given I am logged in as "admin@test.com"
    When I navigate to the lessons page for the test course
    And I click the add lesson button
    Then the new lesson modal should appear

  Scenario: Student views their learning progress
    Given I am logged in as student "student@test.com"
    When I navigate to my learning page
    Then I should see the "My Learning" heading
