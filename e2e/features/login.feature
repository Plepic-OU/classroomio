Feature: Login

  Scenario: Successful login with valid credentials
    Given I am on the login page
    When I login with "admin@test.com" and "123456"
    Then I should be redirected to the dashboard

  Scenario: Failed login with invalid credentials
    Given I am on the login page
    When I login with "admin@test.com" and "wrongpassword"
    Then I should see a login error message
