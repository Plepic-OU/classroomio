Feature: Logout
  An authenticated user can log out and is returned to the login page.

  @login-as-admin
  Scenario: Admin logs out successfully
    Given I am on the org dashboard
    When I log out
    Then I should be redirected to the login page
