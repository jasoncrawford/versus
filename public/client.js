const MAX_DEPTH = 2;

class Versus {
  constructor(seed, output) {
    this.seed = seed;
    this.output = output;
    this.options = {};
    this.queue = [];
    this.outstandingFindCount = 0;
  }

  sortedOptionKeys() {
    let options = this.options;
    let keys = Object.keys(options);
    return keys.sort((a, b) => {
      let depthdiff = options[a].depth - options[b].depth;
      if (depthdiff !== 0) return depthdiff;
      return options[b].count - options[a].count;
    });
  }

  renderOptionCount(keys) {
    let count = $('<p class="option-count"><span class="count"></span> <span class="noun"></span><span class="postfix"></span></p>');
    count.find('.count').text(keys.length);
    count.find('.noun').text(keys.length === 1 ? 'option' : 'options');
    count.find('.postfix').text(this.outstandingFindCount > 0 ? ', finding more…' : ':');
    return count;
  }

  renderOption(key) {
    let options = this.options;
    let info = options[key];

    let el = $('<p class="option"><a class="term" target="_blank"></a> <span class="count"></span> <span class="chain"></span></p>')

    let term = el.find('.term');
    term.text(key);
    term.attr('href', `https://www.google.com/search?${$.param({q: key})}`);

    el.find('.count').text(`${info.count}`);

    let chain = el.find('.chain');

    let i = info;
    while (i.source) {
      let link = $('<span class="chain-link"> &larr; <span class="chain-link-key"></span></span>');
      link.find('.chain-link-key').text(i.source);
      chain.append(link);
      i = options[i.source];
    }

    return el;
  }

  render() {
    let options = this.options;
    let output = this.output;
    let keys = this.sortedOptionKeys();

    let elements = keys.map(key => this.renderOption(key))
    elements.unshift(this.renderOptionCount(keys));

    output.empty();
    output.append(elements);
  }

  fetchAlternatives(term, callback) {
    let queryString = $.param({term});
    let url = `/alternatives?${queryString}`;
    $.ajax(url, {
      success: callback,
      error: (xhr, status) => alert(`error: ${status}`),
    })
  }

  processAlternatives(term, alternatives) {
    let options = this.options;
    alternatives.forEach(alternative => {
      if (alternative in options) {
        options[alternative].count++;
      } else {
        let option = options[term];
        options[alternative] = {source: term, depth: option.depth + 1, count: 1};
        if (options[alternative].depth < MAX_DEPTH) this.findAlternatives(alternative);
      }
    })
  }

  findAlternatives(term) {
    this.outstandingFindCount++;
    this.fetchAlternatives(term, alternatives => {
      this.processAlternatives(term, alternatives);
      this.outstandingFindCount--;
      this.render();
    })
  }

  start() {
    let seed = this.seed;
    if (!seed) return;
    this.options[seed] = {depth: 0, count: 1};
    this.render();
    this.findAlternatives(seed);
  }
}

$(document).ready(() => {
  let form = $('#form');
  let input = form.find('input[name=seed]');
  let output = $('#output');

  form.on('submit', event => {
    event.preventDefault();
    let seed = input.val().trim();
    let search = seed ? `/?seed=${seed}` : '/';
    history.pushState(null, null, search);
    let versus = new Versus(seed, output);
    versus.start();
  })

  function updateFromParams() {
    console.log('updating from params', window.location)
    let params = new URLSearchParams(window.location.search);
    if (params.has('seed')) {
      let seed = params.get('seed');
      input.val(seed);
      let versus = new Versus(seed, output);
      versus.start();
    }
  }

  window.onpopstate = event => {
    console.log('popstate');
    updateFromParams();
  }
  updateFromParams();
})
