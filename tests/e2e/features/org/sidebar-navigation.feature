Feature: Sidebar Navigation

  Scenario: Admin can navigate to Community page
    Given I am logged in as "admin@test.com"
    When I click the "Community" sidebar link
    Then I should be on the community page

  Scenario: Admin can navigate to Audience page
    Given I am logged in as "admin@test.com"
    When I click the "Audience" sidebar link
    Then I should be on the audience page
