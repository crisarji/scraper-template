const constants = require('../constants');
const puppeteer = require('puppeteer');

const isProduction = process.env.NODE_ENV === 'production' ? true : false;
const isDev = !isProduction;
const authenticationError = 'Failed the authentication process';
const bookingError = 'Failed the booking process';

async function startBrowser() {
  let browser = null;
  let context = null;
  let page = null;
  if (isProduction) {
    browser = await puppeteer.launch({
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
    });
    page = await browser.newPage();
  } else {
    browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
      slowMo: 75,
      args: [
        '--auto-open-devtools-for-tabs',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--flag-switches-begin --disable-site-isolation-trials --flag-switches-end',
      ],
    });
    context = await browser.createIncognitoBrowserContext();
    page = await context.newPage();
  }
  return { browser, page };
}

async function doLogIn(page, webSiteUser, webSitePassword) {
  await page.goto(constants.baseUrl + constants.loginEndpoint, {
    timeout: constants.timeOut,
    waitUntil: 'load',
  });
  isDev && console.log('Navigation to Landing Page Succeeded!!!');

  await page.type('#loginform-email', webSiteUser);
  await page.type('#loginform-password', webSitePassword);
  await page.click('button[type="submit"]');
  isDev && console.log('Login submitted');

  await page.waitForSelector('#sidebar');
  isDev && (await page.screenshot({ path: 'screenshots/home-page.png' }));

  return await findLink(page, constants.scheduleEndpoint);
}

async function findLink(page, endpoint) {
  const pageLinks = await page.evaluate(() =>
    Array.from(document.querySelectorAll('a[href]'), (a) =>
      a.getAttribute('href')
    )
  );
  return pageLinks.includes(endpoint) || null;
}

//The booking process in this case is a wizard with the following steps:
//1. Fill in the General Info
//2. Fill in the Date form a picker
//3. Fill in the Time from a list of time items
async function doBooking(page, preferTime) {
  let bookingOutcome = '';
  await fillInGeneralInfo(page).catch(
    (error) => (bookingOutcome = `Error on General Info:: ${error}`)
  );
  bookingOutcome === '' &&
    (await fillInDatePicker(page).catch(
      (error) => (bookingOutcome = `Error on Date Picker:: ${error}`)
    ));
  bookingOutcome === '' &&
    (await fillInTimesAvailable(page, preferTime).catch(
      (error) => (bookingOutcome = `Error on Times Available:: ${error}`)
    ));
  return bookingOutcome;
}

//1. Fill in the General Info
//Since the log in was succeeded, move to the wizard page
//There could be some prefilled info, use Puppeteer for filling the remaining
//in this case, there is a dropdown displayed, in it the option picked it #3
async function fillInGeneralInfo(page) {
  await page.goto(constants.baseUrl + constants.scheduleEndpoint);
  // use manually trigger change event
  await page.evaluate(() => {
    document.querySelector(
      '#classbooking-franchise_id > option:nth-child(3)'
    ).selected = true;
    element = document.querySelector('#classbooking-franchise_id');
    const event = new Event('change', { bubbles: true });
    event.simulated = true;
    element.dispatchEvent(event);
  });
  await page.click('#step1-next-btn');
  await page.waitForTimeout(2000);
}

//2. Fill in the Date form a picker
//Wait for the date picker to be displayed, in this example the auto-booking
//is performed a week from today, so assemble the date with a "+7"
//At the end, pick the date a week from today and click on it
//Note: the logic for excluding, for instance, weekends, can be added here or
//in a cronjob, service, node job, etc
async function fillInDatePicker(page) {
  await page.waitForSelector('#schedule-calendar');
  const today = new Date();
  const aWeekFromTodayUTC = new Date(
    Date.UTC(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + 7,
      0,
      0,
      0
    )
  )
    .getTime()
    .toString();
  const datesAvailable = await page.evaluate(() =>
    Array.from(
      document.querySelectorAll(
        '#schedule-calendar .datepicker-days .table-condensed tbody tr td:not(.disabled)'
      ),
      (element) => element.dataset.date
    )
  );

  if (datesAvailable.includes(aWeekFromTodayUTC)) {
    let el = await page.waitForSelector(
      `#schedule-calendar .datepicker-days .table-condensed tbody tr td[data-date='${aWeekFromTodayUTC}']`,
      { visible: true }
    );
    await el.click(
      `#schedule-calendar .datepicker-days .table-condensed tbody tr td[data-date='${aWeekFromTodayUTC}']`
    );
  }

  await page.waitForTimeout(2000);
}

//3. Fill in the Time from a list of time items
//Wait for the next(or last in this case) step of the wizard
//In case of having a preferred time for the bookings, and it is available
//take it, otherwise, take the very first matching element
//Note: this scenario is flexible(if slot not available pick the first available),
//in case it is required exactly at a time, some checking additional logic could be included here
async function fillInTimesAvailable(page, preferTime) {
  await page.waitForSelector('#booking-timepicker');

  const timesAvailable = await page.evaluate(() =>
    Array.from(
      document.querySelectorAll(
        '#booking-timepicker button.btn.btn-success:not([disabled])'
      ),
      (element) => element.value
    )
  );

  if (timesAvailable.includes(preferTime)) {
    await page.click(`#booking-timepicker button[value="${preferTime}"]`);
  } else {
    let rightTime = '';
    for (let elem of timesAvailable) {
      if (constants.morningTimeRange.includes(elem)) {
        rightTime = elem;
        break;
      }
    }
    await page.click(`#booking-timepicker button[value="${rightTime}"]`);
  }
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);
}

async function getUpcomingBookings(page) {
  return await page.evaluate(
    () => document.querySelector('#upcoming-booking-table').outerHTML
  );
}

async function closeBrowser(browser) {
  return browser.close();
}

async function bookMe(webSiteUser, webSitePassword, preferTime) {
  try {
    const { browser, page } = await startBrowser();
    const isLoggedIn = await doLogIn(page, webSiteUser, webSitePassword);
    isDev && console.log(`Is user logged in?:: ${isLoggedIn}`);

    const bookingOutput = isLoggedIn
      ? await doBooking(page, preferTime)
      : authenticationError;

    closeBrowser(browser);
    return isLoggedIn ? bookingOutput : bookingError;
  } catch (err) {
    console.log(`Puppeteer Error Detected -> ${err}`);
    return `Error:: ${err}`;
  }
}

async function myBookings(webSiteUser, webSitePassword) {
  try {
    const { browser, page } = await startBrowser();
    const isLoggedIn = await doLogIn(page, webSiteUser, webSitePassword);
    isDev && console.log(`Is user logged in?:: ${isLoggedIn}`);
    let upcomingBookings = '';

    if (isLoggedIn) {
      await page.goto(constants.baseUrl + constants.scheduleEndpoint);
      await page.waitForTimeout(2000);
      await page.waitForSelector('#upcoming-booking-table');

      upcomingBookings = await getUpcomingBookings(page);
    }
    closeBrowser(browser);
    return upcomingBookings;
  } catch (err) {
    console.log(`Puppeteer Error Detected -> ${err}`);
    return `Error:: ${err}`;
  }
}

module.exports = {
  bookMe,
  myBookings,
};
