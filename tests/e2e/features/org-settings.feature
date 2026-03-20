Feature: Organization settings

  Scenario: Update organization name
    Given I am on the organization settings page
    When I clear the organization name field
    And I enter the organization name "Updated Org Name"
    And I click the update organization button
    Then I should see a success notification
    And the organization name field should contain "Updated Org Name"
