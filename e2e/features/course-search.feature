Feature: Course Search

  Background:
    Given I am logged in as "admin@test.com" with "123456"
    And I navigate to the courses page

  Scenario: Search filters courses by title
    When I search for "Data Science"
    Then I should see "Data Science with Python and Pandas" in the course list
    And I should not see "Getting started with MVC" in the course list

  Scenario: Empty search shows all courses
    When I search for ""
    Then I should see "Data Science with Python and Pandas" in the course list
    And I should see "Getting started with MVC" in the course list
