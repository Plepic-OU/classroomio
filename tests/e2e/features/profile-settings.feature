Feature: Profile settings

  Scenario: Update profile full name
    Given I am on the profile settings page
    When I clear the full name field
    And I enter the full name "Jane Doe"
    And I click the update profile button
    Then I should see a success notification
    And the full name field should contain "Jane Doe"
