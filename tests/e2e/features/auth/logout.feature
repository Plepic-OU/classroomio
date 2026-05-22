Feature: Logout

  @smoke
  Scenario: Admin can log out and is redirected to the login page
    Given I am on the org dashboard
    When I open the profile menu
    And I click the log out button
    Then I should be on the login page
