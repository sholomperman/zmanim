import express from 'express';
const app = express();
import puppeteer from 'puppeteer';
import qrcode from 'qrcode-terminal';
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;


const now = new Date();
const month = now.getMonth() + 1;
const day = now.getDate();
const year = now.getFullYear();


const main = async (zipCode) => {
  const url = `https://www.chabad.org/calendar/zmanim_cdo/aid/143790/locationid/${zipCode}/locationtype/2/tdate/${month}-${day}-${year}/jewish/Zmanim-Halachic-Times.htm`;
    const browser = await puppeteer.launch({
      args: ['--no-sandbox'],
      headless: 'new'
    });
    const page = await browser.newPage();
    // ? sometimes the page in headless mode opens in phone or other size and this will make sure it opens in desktop version
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/61.0.3163.100 Safari/537.36');
    await page.goto(url);

    const allZmanimContainer = `#group_${month}\\/${day}\\/${year} .item`;
    const zmanimDates = `#date_change_link`;
    const currentLocation = `#CurrentLocation`;
    await page.waitForSelector(zmanimDates);
    await page.waitForSelector(allZmanimContainer);
    await page.waitForSelector(currentLocation);

    async function getTextContent(page, selector) {
      const textContent = await page.evaluate((sel) => {
        const element = document.querySelector(sel);
        return element ? element.textContent.replace(/\n\n/g, ', ').trim() : '';
      }, selector);
      return textContent;
    }

    const zmanimDatesTextContent = await getTextContent(page, zmanimDates);
    const zmanimLocationTextContent = await getTextContent(page, currentLocation);

    const allZmanim = await page.evaluate((allZmanimContainer) => {
        const elements = document.querySelectorAll(allZmanimContainer);
        const extractedData = [];
      
        elements.forEach((el) => {
          const aElements = el.querySelectorAll('.description .item_title');
          const spanElements = el.querySelectorAll('.date_time .large');
          let spanText;
          let aText;
          spanElements.forEach((item, index) => {
             spanText = item.textContent.trim();            
          });
          aElements.forEach((item, index) => {
             aText = item.textContent.trim();
          });
          extractedData.push({
            [aText]: spanText
          });
        });
      
        return extractedData;
      }, allZmanimContainer);
      allZmanim.unshift({ [zmanimLocationTextContent]: zmanimDatesTextContent })
      await browser.close();
      console.log('chrome closed');
    return allZmanim;
};

  
  const client = new Client({
      authStrategy: new LocalAuth()
  });
  
  
  client.on('qr', qr => {
      qrcode.generate(qr, {small: true});
  });
  
  client.on('ready', () => {
      console.log('Client is ready!');
  });

client.on('message', async message => {
  if (!isNaN(message.body)) {
    const zipCode = message.body;

    try {
      const result = await main(zipCode);
      const formattedResult = formatResult(result);
      const formattedMessage = formatMessage(formattedResult);

      await sendMessages(message.from, formattedMessage);
    } catch (error) {
      console.error(error);
    }
  }
  else {
    sendMessages(message.from, 'please send the zip-code for the aria for the zmanim');
  }
});

function formatResult(result) {
  return result.map(obj => {
    return Object.entries(obj).map(([key, value]) => {
      return { key, value };
    });
  });
}

function formatMessage(formattedResult) {
  let message = '';
  formattedResult.forEach(obj => {
    obj.forEach(pair => {
      message += `${pair.key}: ${pair.value}\n`;
    });
    message += '\n';
  });
  return message;
}

async function sendMessages(destination, message) {
  await client.sendMessage(destination, message);
}
  client.initialize();

  app.get('/', (req, res) => {
    res.send('zmanim what\'s app service!')
  })
  const port =  process.env.PORT || 8080;
  app.listen(port, ()=>{
    console.log('listening on port:', port);
  });