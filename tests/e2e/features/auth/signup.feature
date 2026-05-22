Feature: Sign Up

  @generated @skip-needs-investigation
  Scenario: Successful signup redirects to login page
    Given I am on the signup page
    When I fill the signup form with a unique email and password "securepass123"
    Then I should be redirected to the login page

  @generated
  Scenario: Create Account button is disabled when passwords do not match
    Given I am on the signup page
    When I enter signup email "mismatch@test.local"
    And I enter signup password "securepass123"
    And I enter confirm password "differentpass456"
    Then the create account button should be disabled

  @generated
  Scenario: Signup shows validation error for a short password
    Given I am on the signup page
    When I enter signup email "shortpw@test.local"
    And I enter signup password "abc"
    And I enter confirm password "abc"
    And I click the create account button
    Then I should see a password validation error
