Feature: Course People Management

  Background:
    Given I am logged in as "admin@test.com" with password "123456"

  Scenario: Admin views and searches course members
    Given I am on the people page for course "Data Science with Python and Pandas"
    Then I should see members listed in the table
    When I search for "John"
    Then I should see "John Doe" in the people list
