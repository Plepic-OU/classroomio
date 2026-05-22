Feature: Org Settings
  An admin can update their profile settings such as their full name.

  @login-as-admin
  Scenario: Admin updates their full name
    Given I am on the org settings page
    When I update my full name to "Elon Gates Updated"
    And I save the profile settings
    Then I should see "Elon Gates Updated" on the page
