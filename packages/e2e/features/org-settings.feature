Feature: Organization Settings

  Scenario: Admin updates the organization name
    Given I am logged in
    And I am on the organization settings tab
    When I update the organization name to "Test Organization Updated"
    And I click the "Update Organization" button
    Then I should see the update success notification
    When I reload the page
    Then the organization name should be "Test Organization Updated"
    When I restore the original organization name
    And I click the "Update Organization" button
    Then I should see the update success notification
