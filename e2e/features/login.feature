Feature: User Login

  Scenario: Successful login with email and password
    Given I am on the login page
    When I enter email "test-e2e@classroomio.com" and password "TestPass123!"
    And I click the login button
    Then I should be redirected to the dashboard
    And I should see the organization name

  Scenario: Login with invalid credentials
    Given I am on the login page
    When I enter email "wrong@example.com" and password "wrongpassword"
    And I click the login button
    Then I should see an error message
