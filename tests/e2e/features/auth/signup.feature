Feature: Signup

  Scenario: Signup form renders with required fields
    Given I am on the signup page
    Then I should see the email field
    And I should see the password field
    And I should see the create account button

  Scenario: Signup fails when passwords do not match
    Given I am on the signup page
    When I fill the signup form with email "test@example.com" and mismatched passwords
    And I submit the signup form
    Then I should see a password validation error
