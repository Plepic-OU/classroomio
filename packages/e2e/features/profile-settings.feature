Feature: Profile Settings

  Scenario: Profile settings page displays user information
    Given I am logged in
    And I am on the org settings page
    Then I should see the profile form with user data
    And I should see the "Update Profile" button
