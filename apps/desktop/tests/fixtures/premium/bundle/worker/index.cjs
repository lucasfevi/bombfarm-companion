'use strict';

// A harmless worker for loader tests: it asks the host for a capability nobody granted, records the
// answer, and tracks the pause and resume events it is sent.

const events = [];

module.exports.start = function start(host) {
  host.on('paused', () => events.push('paused'));
  host.on('resumed', () => events.push('resumed'));
  host
    .call('fixture.ping', { sequence: host.info.sequence })
    .then((value) => events.push(['reply', value]))
    .catch((error) => events.push(['refused', error && error.message]));
};

module.exports.events = events;
