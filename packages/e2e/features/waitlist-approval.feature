Feature: Waitlist Approval

  Scenario: Teacher sees waitlisted students in People tab
    Given I am logged in
    And there is a course with waitlisted students
    When I navigate to the course people page
    Then I should see the waitlist section
    And I should see the waitlisted student name and email

  Scenario: Teacher approves a waitlisted student
    Given I am logged in
    And there is a course with waitlisted students
    When I navigate to the course people page
    And I click the "Approve" button for the waitlisted student
    Then the student should be removed from the waitlist
