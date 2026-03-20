Feature: Course Submissions

  Background:
    Given I am logged in as a teacher

  Scenario: Teacher views the submissions page for a course
    Given I am on the submissions page for course "Data Science with Python and Pandas"
    Then I should be on the submissions page
