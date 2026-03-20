Feature: Login Error Handling

  Scenario: User sees an error with invalid credentials
    Given I am on the login page
    When I enter email "admin@test.com" and password "wrongpassword"
    And I click the login button
    Then I should see an error message
