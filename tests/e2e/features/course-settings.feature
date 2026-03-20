Feature: Course Settings

  Background:
    Given I am logged in as "admin@test.com" with password "123456"

  Scenario: Admin saves course settings successfully
    Given I am on the settings page for course "Modern Web Development with React"
    When I click the "Save Changes" button
    Then I should see a success notification with text "Saved successfully"
