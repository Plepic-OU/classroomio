Feature: User Authentication

  Background:
    Given I am on the login page

  Scenario: Admin can log in with valid credentials
    When I enter email "admin@test.com" and password "123456"
    And I submit the login form
    Then I should be redirected away from the login page

  Scenario: Login fails with wrong password
    When I enter email "admin@test.com" and password "wrongpassword"
    And I submit the login form
    Then I should see a login error message
