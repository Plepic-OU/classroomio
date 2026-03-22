Feature: Logout

  Scenario: User can log out and is redirected to login page
    Given I am logged in as "admin@test.com"
    When I open the profile menu
    And I click the log out button
    Then I should be on the login page
