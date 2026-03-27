Feature: Logout

  Scenario: User can log out and is redirected to login page
    Given I am logged in as an admin
    When I navigate to the logout page
    Then I should be redirected to the login page
