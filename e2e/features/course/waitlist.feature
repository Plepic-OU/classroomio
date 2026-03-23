Feature: Course Waiting List

  Scenario: Student joins waiting list when course is full
    Given I am logged in as "student@test.com" with password "123456"
    And the course "Getting started with MVC" has waiting list enabled with max capacity 0
    When I visit the invite link for course "Getting started with MVC"
    And I click the join course button
    Then I should see a waiting list confirmation message
