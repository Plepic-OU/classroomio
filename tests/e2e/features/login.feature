Feature: Login

  Scenario: Successful login with valid credentials
    Given I am on the login page
    When I log in as an admin
    Then I should be redirected to the dashboard
