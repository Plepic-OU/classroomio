Feature: Course Detail

  Background:
    Given I am logged in as "admin@test.com" with "123456"
    And I navigate to the courses page

  Scenario: Click a course card to view course details
    When I click on the course "Getting started with MVC"
    Then I should be on the course detail page
    And I should see the course title "Getting started with MVC" in the navigation
