Feature: Organization Settings

  Scenario: Admin updates organization name and confirms persistence
    Given I am logged in as "admin@test.com"
    And I am on the organization settings page
    When I update the organization name to "Udemy Test Updated"
    And I save the organization settings
    Then I should see a success notification
    When I reload the settings page
    Then the organization name field should show "Udemy Test Updated"
    When I update the organization name to "Udemy Test"
    And I save the organization settings
    Then I should see a success notification
