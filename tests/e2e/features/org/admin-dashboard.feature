@auth:admin
Feature: Admin org dashboard

  Scenario: Admin sees their seed organisation on the dashboard
    Given I am on the admin dashboard
    Then I should see the seed organisation in the sidebar
    And the dashboard should greet the admin by name
