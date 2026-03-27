Feature: Course waiting list

  Scenario: Teacher configures max capacity and waitlist in course settings
    Given I am on the org dashboard
    And I navigate to a course settings page
    When I set the max capacity to 5
    And I enable the waiting list toggle
    And I click save
    Then the max capacity input should have value "5"
    And the waiting list toggle should be visible

  Scenario: Student sees course is full when capacity reached and waitlist disabled
    Given I am on the org dashboard
    And I navigate to a course settings page
    When I set the max capacity to 1
    And I click save
    And I navigate to the course landing page
    Then I should see "Course is full"

  Scenario: Student sees join waitlist when course is full and waitlist enabled
    Given I am on the org dashboard
    And I navigate to a course settings page
    When I set the max capacity to 1
    And I enable the waiting list toggle
    And I click save
    And I navigate to the course landing page
    Then I should see a "Join Waiting List" button

  Scenario: Teacher sees empty waiting list tab
    Given I am on the org dashboard
    And I navigate to the course people page
    When I click the waiting list tab
    Then I should see "No students on the waiting list"
