Feature: Reset Password

  @generated
  Scenario: Reset Password button is disabled when passwords do not match
    Given I am on the reset password page
    When I enter new password "securepass123"
    And I enter confirm new password "differentpass456"
    Then the reset password button should be disabled

  @generated
  Scenario: Reset Password shows validation error for a short password
    Given I am on the reset password page
    When I enter new password "abc"
    And I enter confirm new password "abc"
    And I click the reset password submit button
    Then I should see a password validation error
