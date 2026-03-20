Feature: Org settings update

  Scenario: Teacher changes the org name and saves successfully
    Given I am on the org settings organization tab
    When I change the org name and save
    Then I should see a success notification
