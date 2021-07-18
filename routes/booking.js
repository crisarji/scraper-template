const express = require('express');
const router = express.Router();
const emailSender = require('../services/emailSender');
const bookingHandler = require('../services/bookingHandler');
const {
  webSiteUser,
  webSitePassword,
  authUser,
  appPassword,
  emailFrom,
  emailTo,
  preferTime,
} = require('../config');

router.get('/book-me', async function (req, res, next) {
  try {
    const bookMeResult = await bookingHandler.bookMe(
      webSiteUser,
      webSitePassword,
      preferTime
    );
    res.send(`The result of the booking was::${bookMeResult}`);
  } catch (err) {
    console.error(`Error while booking me for next week`, err.message);
    next(err);
  }
});

router.get('/my-bookings', async function (req, res, next) {
  try {
    const bookingResult = await bookingHandler.myBookings(
      webSiteUser,
      webSitePassword
    );
    emailSender.sendEmail(bookingResult, {
      authUser,
      appPassword,
      emailFrom,
      emailTo,
    });
    res.format({
      html: () => res.send(bookingResult),
    });
  } catch (err) {
    console.error(`Error while getting the booking for this week`, err.message);
    next(err);
  }
});

module.exports = router;
