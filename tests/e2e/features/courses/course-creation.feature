Feature: Course Creation
  An authenticated educator can create a new course with a title and description.

  @login-as-admin
  Scenario: Create a new course with a title
    Given I am on the courses page
    When I click the create course button
    And I select a course type and proceed
    And I enter the course title "BDD Test Course"
    And I enter the course description "A short description for the BDD test course"
    And I submit the new course form
    Then I should be redirected to the new course page
