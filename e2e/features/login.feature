Feature: Login

  Scenario: Admin logs in successfully
    Given I am on the login page
    When I enter admin credentials
    And I submit the login form
    Then I should be redirected to the dashboard

  Scenario: Student logs in successfully
    Given I am on the login page
    When I enter student credentials
    And I submit the login form
    Then I should be redirected to the student portal

  Scenario: Login fails with invalid credentials
    Given I am on the login page
    When I enter invalid credentials
    And I submit the login form
    Then I should see an error message
