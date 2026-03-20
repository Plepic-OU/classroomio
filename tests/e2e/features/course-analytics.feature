Feature: Course Analytics

  Background:
    Given I am logged in as a teacher

  Scenario: Teacher views the analytics page for a course
    Given I am on the analytics page for course "Data Science with Python and Pandas"
    Then I should be on the analytics page
