Feature: Auth Guard

  Scenario: Unauthenticated user is redirected to login
    Given I am not logged in
    When I try to access the dashboard directly
    Then I should be redirected to the login page
