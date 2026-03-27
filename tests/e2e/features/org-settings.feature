Feature: Organization settings

  Scenario: Update organization name
    Given I am on the organization settings page
    When I update the organization name to "Updated Org Name"
    Then I should see a success notification
    When I reload the organization settings page
    Then the organization name field should contain "Updated Org Name"
    When I update the organization name to "Udemy Test"
    Then I should see a success notification
