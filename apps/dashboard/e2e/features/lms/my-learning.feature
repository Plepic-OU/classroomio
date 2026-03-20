Feature: My Learning

  @unauthenticated
  Scenario: Student views enrolled courses on my learning page
    Given I am logged in as a student
    When I navigate to the my learning page
    Then I should see the course "Data Science with Python and Pandas"
