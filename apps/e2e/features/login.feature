Feature: Login

  Scenario: Successful login with valid credentials
    Given I am on the login page
    When I enter my admin credentials
    And I click the login button
    Then I should be redirected to the org dashboard

  Scenario: Failed login with invalid credentials
    Given I am on the login page
    When I enter invalid credentials
    And I click the login button
    Then I should see an error message
