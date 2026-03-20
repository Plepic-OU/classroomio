Feature: Course Creation

  Scenario: Create a live class course
    Given I am logged in
    And I am on the org courses page
    When I click the "Create Course" button
    And I select "Live Class" as the course type
    And I click the "Next" button
    And I enter a unique course title
    And I enter "A test course description" as the description
    And I click the "Finish" button
    Then I should see the created course in the course list

  Scenario: Create a self-paced course
    Given I am logged in
    And I am on the org courses page
    When I click the "Create Course" button
    And I select "Self Paced" as the course type
    And I click the "Next" button
    And I enter a unique course title
    And I enter "Self paced description" as the description
    And I click the "Finish" button
    Then I should see the created course in the course list
