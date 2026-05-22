Feature: Marks Viewing

  Scenario: Teacher views marks for a course
    Given I am logged in as "admin@test.com"
    When I navigate to the marks page for the test course
    Then I should see the marks heading
