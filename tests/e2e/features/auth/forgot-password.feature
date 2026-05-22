Feature: Forgot Password

  @generated
  Scenario: Requesting a password reset for a known email shows success state
    Given I am on the forgot password page
    When I enter my email "admin@test.com"
    And I click the reset password button
    Then I should see the email sent confirmation

  @generated
  Scenario: Submitting without an email shows a validation error
    Given I am on the forgot password page
    When I click the reset password button
    Then I should see an email validation error

  @generated
  Scenario: Cancel button navigates back to login
    Given I am on the forgot password page
    When I click the cancel button on the forgot password page
    Then I should be on the login page
