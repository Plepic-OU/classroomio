Feature: Community Q&A

  Scenario: Teacher can access the org community page
    Given I am logged in as "admin@test.com"
    When I navigate to the org community page
    Then I should be on the community page
