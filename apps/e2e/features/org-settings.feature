Feature: Org Settings

  Scenario: Admin updates organization name
    Given I am logged in as an admin
    And I am on the org settings page
    When I update the organization name to "Updated Org Name"
    And I save the organization settings
    Then the organization name should be "Updated Org Name" after reload
    And I restore the organization name to "Udemy Test"
