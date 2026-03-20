Feature: Auth Redirect

  Scenario: Unauthenticated user is redirected to login
    Given I am not logged in
    When I navigate to the org courses page directly
    Then I should be redirected to the login page
