const express = require('express');
const http = require('http');
const https = require('https');
const querystring = require('querystring');
const htmlEntities = require('html-entities');

let app = express();
let port = process.env['PORT'] || 3000;

app.use(express.static('public'));

const get = url => {
  return new Promise((resolve, reject) => {
    let lib = url.startsWith('https') ? https : http;
    let request = lib.get(url, response => {
      if (response.statusCode < 200 || response.statusCode > 299) {
         reject(new Error(`HTTP ${response.statusCode}`));
       }

      let body = [];
      response.on('data', chunk => body.push(chunk));
      response.on('end', () => resolve(body.join('')));
    });

    request.on('error', reject)
  })
};

const fetchCompletions = async q => {
  let queryString = querystring.stringify({q, client: 'psy-ab'});
  let url = `https://www.google.com/complete/search?${queryString}`;
  let body = await get(url);
  let data = JSON.parse(body);
  return data[1].map(item => item[0]);
}

const findAlternatives = async term => {
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

app.get('/alternatives', async (request, response) => {
  try {
    let term = request.query['term'];
    let alternatives = await findAlternatives(term);
    response.send(alternatives);
  } catch (error) {
    repsonse.status(500).send(error.message);
  }
})

app.listen(port, () => console.log(`Listening on port ${port}`));
