@resets-db
Feature: Course Lessons

  Scenario: Teacher adds a lesson to a course
    Given I am logged in as "admin@test.com"
    And I am on the courses page
    When I click the create course button
    And I select a course type and proceed
    And I enter the course title "Lesson Coverage Course"
    And I enter the course description "Course used to verify lesson creation"
    And I submit the new course form
    Then I should be redirected to the new course page
    When I open the course content tab
    And I add a new section titled "Introduction"
    And I add a lesson titled "Getting Started" to the "Introduction" section
    Then I should be redirected to the lesson editor
    And I should see the lesson title "Getting Started"
