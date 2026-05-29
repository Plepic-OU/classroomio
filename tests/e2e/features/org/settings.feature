Feature: Org Settings

  @write
  Scenario: Admin can update the organization name
    Given I am logged in as "admin@test.com"
    And I navigate to the org settings org tab
    When I store the current organization name
    And I update the organization name to "BDD Updated Org"
    And I click the update organization button
    Then I should see "BDD Updated Org" in the organization name field
    When I restore the organization name to the original
    And I click the update organization button
    Then I should see the original organization name in the field
