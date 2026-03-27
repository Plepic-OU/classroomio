Feature: Waitlist Management

  Background:
    Given I am logged in as "admin@test.com" with "123456"

  Scenario: Teacher sees waitlist tab on a course with max capacity
    When I navigate to people for course "Getting started with MVC"
    Then I should see the "Waitlist" tab

  Scenario: Teacher can switch between Enrolled and Waitlist tabs
    When I navigate to people for course "Getting started with MVC"
    And I click the "Waitlist" tab button
    Then I should see waitlisted students
    When I click the "Enrolled" tab button
    Then I should see enrolled students
