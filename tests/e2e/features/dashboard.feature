Feature: Dashboard

  Scenario: View organization dashboard with analytics cards
    Given I am on the org dashboard
    Then I should see the dashboard greeting
    And I should see analytics cards for courses and students
