Feature: Org Settings

  Scenario: Admin updates organization name
    Given I am logged in as "admin@test.com"
    When I navigate to the org settings page
    And I update the organization name to "Updated BDD Org"
    And I click the update organization button
    Then I should see a success notification
    When I reload the org settings page
    Then the organization name field should contain "Updated BDD Org"
    When I restore the organization name to "Udemy Test"
    And I click the update organization button
    Then I should see a success notification
