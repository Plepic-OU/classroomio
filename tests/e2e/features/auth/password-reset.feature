@p0 @noauth
Feature: Password Reset

  Scenario: Request password reset and set new password via email link
    Given I am on the forgot password page
    When I enter the reset email "test@test.com"
    And I submit the password reset form
    Then I should see the email sent confirmation
    When I follow the reset link from the "test" inbox
    And I enter new password "123456"
    And I enter confirm new password "123456"
    And I submit the new password form
    Then I should be redirected to the login page
