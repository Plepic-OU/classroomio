@wave1 @auth
Feature: Logout

  @persona-admin
  Scenario: Logged-in admin can log out and lands on the login page
    Given I am logged in via the admin storage state
    When I navigate to "/logout"
    Then I am redirected to the login page
