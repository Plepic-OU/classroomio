export const ROLE = {
  ADMIN: 1,
  TUTOR: 2,
  STUDENT: 3
};

export const FILTER_VALUE = {
  ALL: 'all',
  WAITLIST: 'waitlist'
};

export const ROLE_LABEL = {
  [ROLE.ADMIN]: 'course.navItem.people.roles.admin',
  [ROLE.TUTOR]: 'course.navItem.people.roles.tutor',
  [ROLE.STUDENT]: 'course.navItem.people.roles.student'
};

export const ROLES = [
  {
    label: 'course.navItem.people.roles.filter',
    value: FILTER_VALUE.ALL
  },
  {
    label: ROLE_LABEL[ROLE.ADMIN],
    value: ROLE.ADMIN
  },
  {
    label: ROLE_LABEL[ROLE.TUTOR],
    value: ROLE.TUTOR
  },
  {
    label: ROLE_LABEL[ROLE.STUDENT],
    value: ROLE.STUDENT
  },
  {
    label: 'course.navItem.people.roles.waitlist',
    value: FILTER_VALUE.WAITLIST
  }
];
