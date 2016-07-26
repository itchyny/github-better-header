;(function() {

  // Promise object of retrieving a web resource
  function get(url) {
    return new Promise(function(resolve, reject) {
      fetch(url).then(function(response) {
        return response.text();
      }).then(resolve);
    });
  }

  // Promise object of gathering variables
  function variablesPromise(variables) {
    var deferred = Promise.defer();
    var values = {};
    deferred.promise.set = function(name, value) {
      values[name] = value;
      if (Object.keys(values).length === variables.filter(function(v) {
        return !v.when || values.hasOwnProperty(v.when) && values[v.when];
      }).length) {
        deferred.resolve(values);
      }
    };
    return deferred.promise;
  }

  // Mutation observer witness with the settings injected
  function witness(setting) {
    var varpromise = variablesPromise(setting.variables);
    var htmlpromise = setting.overwrites.map(function(overwrite) {
      return [ overwrite.fileName, get(chrome.extension.getURL(overwrite.fileName)) ];
    }).reduce(function (o, v) { o[v[0]] = v[1]; return o; }, {});
    return function(mutations) {
      [].forEach.call(mutations, function(mutation) {
        [].forEach.call(mutation.addedNodes || [], function(node) {
          // we firstly check variables
          setting.variables.forEach(function(variable) {
            if (!variable.done && node.getAttribute
              && (node.getAttribute('name') === variable.name
              ||  node.className === variable.className)) {
              varpromise.set(variable.title, node.getAttribute(variable.attribute));
              variable.done = true;
            }
          });
          // then check whether or not we overwrite the element
          setting.overwrites.forEach(function(overwrite) {
            if (!overwrite.done && node.className === overwrite.className) {
              node.style.display = 'none';
              htmlpromise[overwrite.fileName].then(function(innerHTML) {
                varpromise.then(function(variables) {
                  if (!overwrite.when || variables[overwrite.when]) {
                    node.innerHTML = Object.keys(variables).reduce(function(innerHTML, name) {
                      return innerHTML.replace(new RegExp('{{ *' + name  + ' *}}', 'g'), variables[name]);
                    }, innerHTML);
                  }
                  node.style.display = '';
                });
              });
              overwrite.done = true;
            }
          });
        });
      });
      // if all things done, stop observation
      if (setting.variables.every(function(variable) { return variable.done; })
      && setting.overwrites.every(function(overwrite) { return overwrite.done; })) {
        this.disconnect();
      }
    };
  }

  // overwrite the page with the settings injected
  function start(setting) {
    var observer = new MutationObserver(witness(setting));
    observer.observe(setting.target, setting.config);
  }

  // we start the process
  start({
    target: document,
    config: { childList: true, subtree: true },
    overwrites: [
      {
        className: 'header-nav left',
        fileName: 'header-nav-left.html',
        when: 'user'
      },
      {
        className: 'header-nav user-nav right',
        fileName: 'header-nav-right.html',
        when: 'user'
      }
    ],
    variables: [
      {
        title: 'user',
        name: 'user-login',
        attribute: 'content'
      },
      {
        title: 'avatar',
        className: 'avatar',
        attribute: 'src',
        when: 'user'
      },
      {
        title: 'authenticity_token',
        name: 'authenticity_token',
        attribute: 'value',
        when: 'user'
      },
      {
        title: 'form_nonce',
        name: 'form-nonce',
        attribute: 'content',
        when: 'user'
      }
    ]
  });

})();
