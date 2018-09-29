class VersusModel {
  constructor(seed) {
    this.seed = (seed || '').toLowerCase();
    this.options = {};
    this.queue = [];
    this.outstandingFindCount = 0;
    this.maxDepth = 2;
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

  fetchAlternatives(term, callback) {
    let queryString = $.param({term});
    let url = `/alternatives?${queryString}`;
    $.ajax(url, {
      success: callback,
      error: (xhr, status) => {
        let detail = xhr && `${xhr.statusText}: ${xhr.responseText}`;
        this.callDelegateWithError(detail);
      },
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
        if (options[alternative].depth < this.maxDepth) this.findAlternatives(alternative);
      }
    })
  }

  callDelegate() {
    if (!this.delegate) return;
    this.delegate.onAlternativesUpdated();
  }

  callDelegateWithError(detail) {
    if (!this.delegate) return;
    this.delegate.onErrorFetchingAlternatives(detail);
  }

  findAlternatives(term) {
    if (!term) return;
    this.outstandingFindCount++;
    this.fetchAlternatives(term, alternatives => {
      this.processAlternatives(term, alternatives);
      this.outstandingFindCount--;
      this.callDelegate();
    })
  }

  start() {
    let seed = this.seed;
    if (seed) this.options[seed] = {depth: 0, count: 1};
    this.callDelegate();
    this.findAlternatives(seed);
  }
}

class VersusView {
  constructor(el, model) {
    this.model = model;
    this.el = $(el);
    this.form.on('submit', event => this.onSubmit(event));
  }

  get form() {
    return this.el.find('.main-form');
  }

  get input() {
    return this.form.find('input[name=seed]');
  }

  get output() {
    return this.el.find('.output');
  }

  get optionCountTemplate() {
    return '<p class="option-count"><span class="count"></span> <span class="noun"></span><span class="postfix"></span></p>';
  }

  get optionTemplate() {
    return '<p class="option"><a class="term" target="_blank"></a> <span class="count"></span> <span class="chain"></span></p>';
  }

  get chainLinkTemplate() {
    return '<span class="chain-link"> &larr; <span class="chain-link-key"></span></span>';
  }

  get errorMessageTemplate() {
    return '<div><p class="error-header">Error fetching alternatives 😫</p><p class="error-detail"></p></div>';
  }

  googleSearchUrl(q) {
    return `https://www.google.com/search?${$.param({q})}`
  }

  setModelFromSeed(seed) {
    this.model = new VersusModel(seed);
    this.model.delegate = this;
    this.model.start();
  }

  setSeed(seed) {
    this.input.val(seed);
    this.setModelFromSeed(seed);
  }

  onSubmit(event) {
    event.preventDefault();
    let seed = this.input.val().trim();
    let search = seed ? `/?seed=${seed}` : '/';
    history.pushState(null, null, search);
    this.setModelFromSeed(seed);
  }

  onAlternativesUpdated() {
    this.render();
  }

  onErrorFetchingAlternatives(detail) {
    this.renderError(detail);
  }

  renderOptionCount(keys) {
    let count = $(this.optionCountTemplate);
    count.find('.count').text(keys.length);
    count.find('.noun').text(keys.length === 1 ? 'option' : 'options');
    count.find('.postfix').text(this.model.outstandingFindCount > 0 ? ', finding more…' : ':');
    return count;
  }

  renderOption(key) {
    let options = this.model.options;
    let info = options[key];

    let p = $(this.optionTemplate)

    let term = p.find('.term');
    term.text(key);
    term.attr('href', this.googleSearchUrl(key));

    p.find('.count').text(`${info.count}`);

    let chain = p.find('.chain');

    let i = info;
    while (i.source) {
      let link = $(this.chainLinkTemplate);
      link.find('.chain-link-key').text(i.source);
      chain.append(link);
      i = options[i.source];
    }

    return p;
  }

  render() {
    if (!this.model || !this.model.seed) {
      this.output.empty();
      return;
    }

    let keys = this.model.sortedOptionKeys();

    let elements = keys.map(key => this.renderOption(key))
    elements.unshift(this.renderOptionCount(keys));

    this.output.empty();
    this.output.append(elements);
  }

  renderError(detail) {
    let errorMessage = $(this.errorMessageTemplate);
    if (detail) {
      errorMessage.find('.error-detail').text(detail);
    }

    this.output.empty();
    this.output.append(errorMessage);
  }
}

$(document).ready(() => {
  let el = $('#versus-view');
  let view = new VersusView(el);

  function updateFromParams() {
    let params = new URLSearchParams(window.location.search);
    let seed = params.get('seed');
    view.setSeed(seed);
  }

  window.onpopstate = updateFromParams;

  updateFromParams();
})
