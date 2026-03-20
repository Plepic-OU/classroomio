Feature: Logout

  Scenario: User can log out and is redirected to login page
    Given I am logged in as "admin@test.com" with "123456"
    When I navigate to the logout page
    Then I should be on the login page
