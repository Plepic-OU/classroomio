Feature: Organization Settings

  Background:
    Given I am logged in as "admin@test.com" with "123456"

  Scenario: Admin updates organization name and it persists after reload
    When I navigate to organization settings for "udemy-test"
    And I set the organization name to "Udemy Test Renamed"
    And I save the organization settings
    And I reload the settings page
    Then the organization name should be "Udemy Test Renamed"
    And I restore the organization name to "Udemy Test"
