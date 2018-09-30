const express = require('express');
const http = require('http');
const https = require('https');
const querystring = require('querystring');
const request = require('request-promise-native');
const htmlEntities = require('html-entities');

let app = express();
let port = process.env['PORT'] || 3000;

app.set('view engine', 'ejs');

app.use(express.static('public'));

async function fetchCompletions(q) {
  let queryString = querystring.stringify({q, client: 'psy-ab'});
  let url = `https://www.google.com/complete/search?${queryString}`;
  let body = await request(url);
  let data = JSON.parse(body);
  return data[1].map(item => item[0]);
}

async function findAlternatives(term) {
  let q = `${term} vs `;
  let completions = await fetchCompletions(q);
  let alternatives = completions.map(completion => {
    if (!completion.startsWith(q.trim())) return []; // filter anything that's not a true completion
    let text = completion.replace(/\<\/?b\>/g, ''); // strip bold tags
    return text.split(/\s*\bvs\b\s*/);    // split on 'vs'
  })
  alternatives = [].concat.apply([], alternatives); // flatten
  alternatives = alternatives.map(a => {
    a = a.trim();
    a = htmlEntities.Html5Entities.decode(a); // translate HTML entities such as 'trader joe&#39;s'
    a = a.replace(/ 20\d\d$/, '');  // eliminate the 'foo 2018' pattern
    a = a.replace(/ reddit$/, '');  // eliminate the 'foo reddit' pattern
    return a;
  })
  return alternatives.filter(a => a); // compact
}

app.get('/', async (request, response) => {
  try {
    let seed = request.query['seed'];
    response.render('index', {seed});
  } catch (error) {
    response.status(500).send(error.message);
  }
})

app.get('/about', async (request, response) => {
  try {
    response.render('about');
  } catch (error) {
    response.status(500).send(error.message);
  }
})

app.get('/alternatives', async (request, response) => {
  try {
    let term = request.query['term'];
    let alternatives = await findAlternatives(term);
    response.send(alternatives);
  } catch (error) {
    response.status(500).send(error.message);
  }
})

app.listen(port, () => console.log(`Listening on port ${port}`));
