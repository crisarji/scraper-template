const env = process.env;

const config = {
  webSiteUser: env.WEB_SITE_USER,
  webSitePassword: env.WEB_SITE_PASSWORD,
  authUser: env.GMAIL_AUTH_USER,
  appPassword: env.GMAIL_APP_PASSWORD,
  emailFrom: env.GMAIL_EMAIL_FROM,
  emailTo: env.GMAIL_EMAIL_TO,
  preferTime: env.BOOKING_PREFER_TIME,
};

module.exports = config;
