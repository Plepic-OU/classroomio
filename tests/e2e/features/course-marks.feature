Feature: Course Marks

  Background:
    Given I am logged in as a teacher

  Scenario: Teacher views the marks page for a course
    Given I am on the marks page for course "Data Science with Python and Pandas"
    Then I should be on the marks page
