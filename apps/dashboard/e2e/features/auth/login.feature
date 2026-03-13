Feature: Login

  @unauthenticated
  Scenario: Successful login with valid credentials
    Given I am on the login page
    When I enter my test credentials
    And I click the login button
    Then I should be redirected to the dashboard
