Feature: Course People Management

  Background:
    Given I am logged in as a teacher

  Scenario: Teacher views students enrolled in a course
    Given I am on the people page for course "Data Science with Python and Pandas"
    Then I should see student "John Doe" in the list
