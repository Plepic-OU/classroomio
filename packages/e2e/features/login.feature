Feature: Login

  Scenario: Successful login with valid credentials
    Given I am on the login page
    When I enter the test user credentials
    And I click the "Log In" button
    Then I should be redirected to the org courses page

  Scenario: Login fails with invalid password
    Given I am on the login page
    When I enter the test user email with password "wrongpassword"
    And I click the "Log In" button
    Then I should see an error message
