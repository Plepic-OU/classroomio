Feature: Exercise Submissions
  An educator can view the submissions page for a course.

  Background:
    Given I am on the courses page
    And I click the create course button
    And I select a course type and proceed
    And I enter the course title "BDD Submissions Course"
    And I enter the course description "Course for submission test"
    And I submit the new course form
    And I should be redirected to the new course page

  @login-as-admin
  Scenario: Educator views the submissions page
    When I go to the submissions tab
    Then I should see the submissions page heading
