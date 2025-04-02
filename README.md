# Cron Monitor Event Service

## Preamble

Connects to a designated [WAMP Router](#), monitors [Cron Monitor Models](#), and publishes events to subscribed clients.

## Events

### `io.outlawdesigns.cron.jobCreated`

A new `Job` has been registered. Returns an array with a single element containing the new `Job` object.

```
[
  {
    id: 13,
    title: 'LDAP Backup',
    description: 'Export LDAP Schema to .ldif file. Encrypt and upload to Google Drive.',
    hostname: 'accounts',
    user: 'root',
    cronTime: '*/1 * * * *',
    friendlyTime: 'Every Minute',
    cmdToExec: '(time /usr/bin/node /home/outlaw/Documents/SlapcatGpgDrive)',
    outfile: '/tmp/ldapbackup',
    container: 0,
    imgName: null,
    shell: null,
    pathVariable: null,
    tz_code: 'America/Chicago',
    cronWrapperPath: null,
    created_date: '2025-04-02T18:03:40.000Z'
  }
]

```

### `io.outlawdesigns.cron.jobChanged`

An existing `Job` has had its properties modified. Returns an array with two elements: the original state of the `Job` object and the new state of the `Job` object.

```
[
  {
    id: 10,
    title: 'LDAP Backup',
    description: 'Export LDAP Schema to .ldif file. Encrypt and upload to Google Drive.',
    hostname: 'accounts',
    user: 'root',
    cronTime: '*/1 * * * *',
    friendlyTime: 'Every Minute',
    cmdToExec: '(time /usr/bin/node /home/outlaw/Documents/SlapcatGpgDrive)',
    outfile: '/tmp/ldapbackup',
    container: 0,
    imgName: null,
    shell: null,
    pathVariable: null,
    tz_code: null,
    cronWrapperPath: null,
    created_date: '2024-10-26T12:43:40.000Z'
  },
  {
    id: 10,
    title: 'LDAP Backup',
    description: 'Export LDAP Schema to .ldif file. Encrypt and upload to Google Drive.',
    hostname: 'accounts',
    user: 'root',
    cronTime: '*/5 * * * *',
    friendlyTime: 'Every 5 Minutes',
    cmdToExec: '(time /usr/bin/node /home/outlaw/Documents/SlapcatGpgDrive)',
    outfile: '/tmp/ldapbackup',
    container: 0,
    imgName: null,
    shell: null,
    pathVariable: null,
    tz_code: null,
    cronWrapperPath: null,
    created_date: '2024-10-26T12:43:40.000Z'
  }
]

```

### `io.outlawdesigns.cron.jobDeleted`

An existing `Job` has been deleted. Returns an array with a single element containing the deleted `Job` object.

```
[
  {
    id: 12,
    title: 'LDAP Backup',
    description: 'Export LDAP Schema to .ldif file. Encrypt and upload to Google Drive.',
    hostname: 'accounts',
    user: 'root',
    cronTime: '*/1 * * * *',
    friendlyTime: 'Every Minute',
    cmdToExec: '(time /usr/bin/node /home/outlaw/Documents/SlapcatGpgDrive)',
    outfile: '/tmp/ldapbackup',
    container: 0,
    imgName: null,
    shell: null,
    pathVariable: null,
    tz_code: 'America/Chicago',
    cronWrapperPath: null,
    created_date: '2025-04-02T18:02:35.000Z'
  }
]

```

### `io.outlawdesigns.cron.executionComplete`

An  `Execution` has been successfully logged. Returns an array with two elements: The associated `Job` object and the new `Execution`.

```
[
  {
    id: 10,
    title: 'LDAP Backup',
    description: 'Export LDAP Schema to .ldif file. Encrypt and upload to Google Drive.',
    hostname: 'accounts',
    user: 'root',
    cronTime: '*/5 * * * *',
    friendlyTime: 'Every 5 Minutes',
    cmdToExec: '(time /usr/bin/node /home/outlaw/Documents/SlapcatGpgDrive)',
    container: 0,
    imgName: null,
    outfile: '/tmp/ldapbackup',
    shell: null,
    pathVariable: null,
    tz_code: null,
    cronWrapperPath: null,
    created_date: '2024-10-26 07:43:40'
  },
  {
    id: 4003,
    jobId: 10,
    startTime: '2025-03-26T06:05:01.000Z',
    endTime: '2025-03-26T06:05:12.000Z',
    output: '(node:15366) ExperimentalWarning: The http2 module is an experimental API.Pruned existing backup...Backed up schema example.com...Encrypted schema example.com...Uploaded example.com.ldif.gpg to GoogleDrive...real0m9.022suser0m6.038ssys0m0.250s'
  }
]
```

### `io.outlawdesigns.cron.illegalExecution`

An `Execution` has been inserted for a disabled or unregistered job. Returns an array with a single element containing the invalid `Execution`.

```
[
  {
    id: 4004,
    jobId: 29,
    startTime: '2025-03-26T06:05:01.000Z',
    endTime: '2025-03-26T06:05:12.000Z',
    output: '(node:15366) ExperimentalWarning: The http2 module is an experimental API.Pruned existing backup...Backed up schema example.com...Encrypted schema example.com...Uploaded example.com.ldif.gpg to GoogleDrive...real0m9.022suser0m6.038ssys0m0.250s'
  }
]

```

### `io.outlawdesigns.cron.executionMissed`

A `Job` has exceeded its expected execution time. Returns an array with a single element containing the overdue `Job`.

```
[
  {
    id: 10,
    title: 'LDAP Backup',
    description: 'Export LDAP Schema to .ldif file. Encrypt and upload to Google Drive.',
    hostname: 'accounts',
    user: 'root',
    cronTime: '*/5 * * * *',
    friendlyTime: 'Every 5 Minutes',
    cmdToExec: '(time /usr/bin/node /home/outlaw/Documents/SlapcatGpgDrive)',
    container: 0,
    imgName: null,
    outfile: '/tmp/ldapbackup',
    shell: null,
    pathVariable: null,
    tz_code: null,
    cronWrapperPath: null,
    created_date: '2024-10-26 07:43:40'
  }
]

```
