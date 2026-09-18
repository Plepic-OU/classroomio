@resets-db
Feature: Course People List

  Scenario: Teacher views the people list for a course
    Given I am logged in as "admin@test.com"
    And I am on the courses page
    When I click the create course button
    And I select a course type and proceed
    And I enter the course title "People List Course"
    And I enter the course description "Course used to verify the people list view"
    And I submit the new course form
    Then I should be redirected to the new course page
    When I open the course people tab
    Then I should see myself listed as "Tutor" in the people table
