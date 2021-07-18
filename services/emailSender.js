const nodemailer = require('nodemailer');

async function sendEmail(
  weekBookings,
  { authUser, appPassword, emailFrom, emailTo }
) {
  const mail = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: authUser,
      pass: appPassword,
    },
  });

  const mailOptions = {
    from: emailFrom,
    to: emailTo,
    subject: 'Your bookings for this week',
    html: weekBookings,
  };

  mail.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log(error);
    } else {
      console.log('Email sent: ' + info.response);
    }
  });
}

module.exports = {
  sendEmail,
};
