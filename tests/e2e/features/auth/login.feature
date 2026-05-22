Feature: Login

  Scenario: Successful login with valid credentials
    Given I am on the login page
    When I enter email "admin@test.com"
    And I enter password "123456"
    And I click the login button
    Then I should be redirected to the org dashboard

  Scenario: Failed login with invalid password
    Given I am on the login page
    When I enter email "admin@test.com"
    And I enter password "wrongpassword"
    And I click the login button
    Then I should see an error message

  Scenario: Logout returns the user to the login page
    Given I am logged in as "admin@test.com"
    When I log out
    Then I should be on the login page
