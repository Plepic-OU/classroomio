@p0 @noauth @needs-reset
Feature: Signup

  Scenario: New account signup creates an auth user
    Given I am on the signup page
    When I enter signup email "newuser@test.com"
    And I enter signup password "TestPass1!"
    And I enter confirm password "TestPass1!"
    And I submit the signup form
    Then the user "newuser@test.com" should exist in auth.users
