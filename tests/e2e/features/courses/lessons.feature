Feature: Course Lessons

  Background:
    Given I am logged in as "admin@test.com"
    And I am on the courses page
    And I click the create course button
    And I select a course type and proceed
    And I enter the course title "Lessons Feature Test"
    And I enter the course description "A course to test lessons"
    And I submit the new course form
    And I should be redirected to the new course page

  @generated
  Scenario: Teacher can view the lessons page for a course
    When I navigate to the course content tab
    Then I should see the lessons page with an add button

  @generated
  Scenario: Teacher can add a new section to a course
    When I navigate to the course content tab
    And I click the add lesson button
    And I enter the new lesson title "Introduction to Testing"
    And I save the new lesson
    Then I should see the new section on the lessons page
