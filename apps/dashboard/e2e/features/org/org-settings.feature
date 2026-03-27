Feature: Organization Settings

  Scenario: Admin navigates to organization settings
    Given I am on the org settings page
    Then I should see the organization settings form

  Scenario: Admin updates organization name
    Given I am on the org settings page
    When I change the organization name to "Test Org Renamed"
    And I click the update organization button
    Then I should see a success notification
    When I reload the org settings page
    Then the organization name should be "Test Org Renamed"
    And I restore the original organization name
