Feature: Signup

  Scenario: Teacher signs up with a new account
    Given I am on the signup page
    When I enter signup email "bddtest@example.com"
    And I enter signup password "123456"
    And I enter confirm password "123456"
    And I click the create account button
    Then I should be redirected to the onboarding page

  Scenario: Signup fails when passwords do not match
    Given I am on the signup page
    When I enter signup email "bddtest@example.com"
    And I enter signup password "123456"
    And I enter confirm password "654321"
    Then I should see a password mismatch error
