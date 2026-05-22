Feature: Course Settings
  An educator can update course settings such as the course title.

  Background:
    Given I am on the courses page
    And I click the create course button
    And I select a course type and proceed
    And I enter the course title "BDD Settings Course"
    And I enter the course description "Course for settings test"
    And I submit the new course form
    And I should be redirected to the new course page

  @login-as-admin
  Scenario: Educator updates the course title
    When I go to the course settings tab
    And I update the course title to "Updated BDD Course"
    And I save the course settings
    Then I should see "Updated BDD Course" in the course header
