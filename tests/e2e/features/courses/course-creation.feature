Feature: Course Creation

  @auth-admin
  Scenario: create-course
    Given I am on the courses page
    When I click the create course button
    And I select a course type and proceed
    And I enter the course title based on this scenario
    And I enter the course description "A short description for the BDD test course"
    And I submit the new course form
    Then I should be redirected to the new course page
