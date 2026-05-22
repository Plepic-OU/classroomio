Feature: Lesson Management
  An educator can create and view lessons inside a course.

  Background:
    Given I am on the courses page
    And I click the create course button
    And I select a course type and proceed
    And I enter the course title "BDD Lessons Course"
    And I enter the course description "Course for lesson management test"
    And I submit the new course form
    And I should be redirected to the new course page

  @login-as-admin
  Scenario: Educator creates a new lesson
    When I go to the lessons tab
    And I click the add lesson button
    And I enter the lesson title "Introduction to BDD"
    And I save the new lesson
    Then I should see "Introduction to BDD" in the lessons list
