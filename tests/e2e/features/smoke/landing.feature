@smoke @wave0 @no-reset
Feature: Wave 0 — Landing surface

  The unauthenticated entry point must offer both Log in and Sign Up.
  If this fails, no other scenario can possibly pass.

  Scenario: Login page exposes Log in and Sign Up
    Given I open the login page
    Then I see the Log in submit button
    And I see a Sign Up link pointing at "/signup"
