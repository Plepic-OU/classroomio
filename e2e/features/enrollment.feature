Feature: Student course enrollment

  @enrollment
  Scenario: Student joins a course via invite link
    Given I am logged in as "student@test.com"
    When I visit the invite link for "Getting started with MVC"
    Then I should see the course invite page with title "Getting started with MVC"
    When I click the join course button
    Then I should be redirected to the LMS page
