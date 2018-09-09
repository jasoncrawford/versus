#!/usr/bin/env node

const util = require('util');
const http = require('http');
const https = require('https');
const querystring = require('querystring');

let calls = 0;
const get = url => {
  // console.log(`fetching ${url}`);
  return new Promise((resolve, reject) => {
    let lib = url.startsWith('https') ? https : http;
    calls++;
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

const fetchCompletions = async term => {
  let q = `${term} vs `;
  let queryString = querystring.stringify({q, client: 'psy-ab'});
  let url = `https://www.google.com/complete/search?${queryString}`;
  let body = await get(url);
  return JSON.parse(body);
}

const findAlternatives = async term => {
  let response = await fetchCompletions(term);
  let completions = response[1];
  let alternatives = completions.map(completion => {
    let text = completion[0];
    text = text.replace(/\<\/?b\>/g, ''); // strip bold tags
    return text.split(/\s*\bvs\b\s*/);    // split on 'vs'
  })
  alternatives = [].concat.apply([], alternatives); // flatten
  alternatives = alternatives.map(a => {
    a = a.trim();
    a = a.replace(/ 20\d\d$/, '');  // eliminate the 'foo 2018' pattern
    a = a.replace(/ reddit$/, '');  // eliminate the 'foo reddit' pattern
    return a;
  })
  return alternatives.filter(a => a); // compact
}

const MAX_DEPTH = 3;
const MAX_OPTIONS = 1000;

const findAllOptions = async seed => {
  let options = {[seed]: {isSeed: true, depth: 0, count: 1}};
  let queue = [seed];
  // console.log(`terms: ${util.inspect(terms)}`)

  while (queue.length > 0) {
    let term = queue.shift();
    let option = options[term];
    let alternatives = await findAlternatives(term);
    alternatives.forEach(alternative => {
      if (alternative in options) {
        options[alternative].count++;
      } else {
        options[alternative] = {source: term, depth: option.depth + 1, count: 1};
        if (options[alternative].depth < MAX_DEPTH) queue.push(alternative);
      }
    })
    if (Object.keys(options).length >= MAX_OPTIONS) break;
  }

  return options;
}

const versus = async seed => {
  let start = new Date();

  let options = await findAllOptions(seed);
  let keys = Object.keys(options);
  keys = keys.sort((a, b) => {
    let depthdiff = options[a].depth - options[b].depth;
    if (depthdiff !== 0) return depthdiff;
    return options[b].count - options[a].count;
  });
  let end = new Date();

  console.log(`${keys.length} options:`);
  keys.forEach(key => {
    let info = options[key];
    let i = info;
    let chain = [];
    while (i.source) {
      chain.push(` <- ${i.source}`);
      i = options[i.source];
    }
    console.log(`${key} (${info.count})${chain.join('')}`);
  })

  let elapsed = (end - start)/1000;
  console.log(`${elapsed} sec; ${calls} calls`);
}

let seed = process.argv[2]
// console.log(`seed: ${seed}`);
versus(seed);
