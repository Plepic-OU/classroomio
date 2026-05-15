Feature: Logout

  Scenario: Logged-in user can log out
    Given I am logged in as "admin@test.com"
    When I navigate to the logout page
    Then I should be redirected to the login page
