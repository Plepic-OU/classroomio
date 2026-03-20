Feature: Course List

  Background:
    Given I am logged in as a teacher

  Scenario: Teacher sees their courses on the courses page
    When I navigate to the courses page
    Then the courses page should show "Data Science with Python and Pandas"
    And the courses page should show "Getting started with MVC"
