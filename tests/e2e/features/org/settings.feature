Feature: Org settings update

  Scenario: Admin updates the organization name and changes persist after reload
    Given I am on the org settings organization tab
    When I change the org name and save
    Then I should see a success notification
    And the org name persists after page reload
    And the original org name is restored
