Feature: Signup

  @no-auth
  Scenario: signup-to-org
    Given I am on the signup page
    When I sign up with a unique test email
    And I enter signup password "Test123456!"
    And I enter signup confirm password "Test123456!"
    And I submit the signup form
    Then I should be redirected to the onboarding page after signup
