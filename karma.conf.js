// Karma configuration for Video Optimizer
// https://karma-runner.github.io/6.4/config/configuration-file.html

module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine', '@angular-devkit/build-angular'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage')
    ],
    client: {
      jasmine: {
        // Jasmine configuration
        random: true,
        seed: '4321'
      },
      clearContext: false, // leave Jasmine Spec Runner output visible in browser
      // Angular 20 Zone.js configuration
      zone: {
        init: true,
        onReady: true
      }
    },
    jasmineHtmlReporter: {
      suppressAll: true // removes the duplicated traces
    },
    coverageReporter: {
      dir: require('path').join(__dirname, './coverage/video-optimizer'),
      subdir: '.',
      reporters: [
        { type: 'html' },
        { type: 'text-summary' },
        { type: 'lcovonly' },
        { type: 'json-summary' }
      ],
      // Coverage thresholds
      check: {
        global: {
          statements: 80,
          branches: 75,
          functions: 80,
          lines: 80
        },
        each: {
          statements: 70,
          branches: 65,
          functions: 70,
          lines: 70
        }
      }
    },
    reporters: ['progress', 'kjhtml', 'coverage'],
    browsers: ['Chrome'],
    // CI configuration
    customLaunchers: {
      ChromeHeadlessCI: {
        base: 'ChromeHeadless',
        flags: [
          '--no-sandbox',
          '--disable-web-security',
          '--disable-gpu',
          '--remote-debugging-port=9222'
        ]
      }
    },
    restartOnFileChange: true,
    // Performance settings
    browserNoActivityTimeout: 60000,
    browserDisconnectTimeout: 10000,
    captureTimeout: 120000,
    // File watching
    autoWatch: true,
    singleRun: false,
    // Logging
    logLevel: config.LOG_INFO,
    colors: true
  });

  // Use headless Chrome in CI
  if (process.env.CI) {
    config.set({
      browsers: ['ChromeHeadlessCI'],
      singleRun: true,
      autoWatch: false
    });
  }
};