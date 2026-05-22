Feature: Member Management
  An educator can manage course members via the People tab.

  Background:
    Given I am on the courses page
    And I click the create course button
    And I select a course type and proceed
    And I enter the course title "BDD People Course"
    And I enter the course description "Course for member management test"
    And I submit the new course form
    And I should be redirected to the new course page

  @login-as-admin
  Scenario: Educator views the people page
    When I go to the people tab
    Then I should see the people table
