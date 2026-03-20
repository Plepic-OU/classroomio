Feature: Course People Search by Name

  Background:
    Given I am logged in as "admin@test.com" with password "123456"

  Scenario: Admin searches for themselves on the Data Science course people page
    Given I am on the people page for course "Data Science with Python and Pandas"
    Then I should see members listed in the table
    When I search for "Elon"
    Then I should see "Elon Gates" in the people list
