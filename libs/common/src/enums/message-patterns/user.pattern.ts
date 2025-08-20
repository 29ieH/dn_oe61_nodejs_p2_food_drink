export enum UserMsgPattern {
  USER_GET_BY_EMAIL = 'user.getByEmail',
  FIND_OR_CREATE_USER_FROM_FACEBOOK = 'user.findOrCreateUserFromFacebook',
  CHECK_USER_EXISTS = 'CHECK_USER_EXISTS',
  CREATE_USER_TWITTER = 'CREATE_USER_TWITTER',
  CREATE_OAUTH_USER = 'CREATE_OAUTH_USER',
  REGISTER_USER = 'REGISTER_USER',
  CHANGE_IS_ACTIVE = 'CHANGE_IS_ACTIVE',
  CREATE_USER = 'user.createUser',
  ADMIN_CREATE_USER = 'admin.user.createUser',
  ADMIN_UPDATE_ROLE = 'admin.user.updateRole',
  ADMIN_UPDATE_STATUS = 'admin.user.updateStatus',
  ADMIN_DELETE_USER = 'admin.user.deleteUser',
}
