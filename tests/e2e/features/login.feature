Feature: Login

  Scenario: Teacher logs in with valid credentials
    Given I am on the login page
    When I fill in the email "admin@test.com"
    And I fill in the password "123456"
    And I click the login button
    Then I should be redirected to my organisation dashboard
