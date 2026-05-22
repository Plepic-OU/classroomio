Feature: Logout

  @auth-admin
  Scenario: logout
    Given I am on the org dashboard
    When I navigate to the logout page
    Then I should be redirected to the login page
