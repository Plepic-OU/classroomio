Feature: Organization Settings

  # Needs ~11s against the dev server (a save plus a full reload, and the name field fills
  # in asynchronously after each load), just over the suite's 10s default.
  @timeout:20000
  Scenario: Admin updates the organization name
    Given I am logged in as "admin@test.com"
    When I open the organization settings
    And I change the organization name to "BDD Org"
    And I reload the page
    Then the organization name should be the new name
    When I restore the original organization name
    Then the organization name should be the original name
