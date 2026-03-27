Feature: Forgot Password

  Scenario: User requests a password reset email
    Given I am on the login page
    When I click the forgot password link
    And I enter my email for password reset "admin@test.com"
    And I click the reset password button
    Then I should see the email sent confirmation
