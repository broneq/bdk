// Hidden acceptance tests of the execute A/B task (evals/suites/execute-ab),
// copied into the run's copy only after the session ended.
import { describe, expect, it } from 'vitest'

import { auditCsvFilename, toAuditCsv } from './auditCsv'

const HEADER = 'id,createdAt,targetType,targetId,action,actorLogin,summary\r\n'

describe('toAuditCsv (hidden)', () => {
  it('writes the header line only for no entries', () => {
    expect(toAuditCsv([])).toBe(HEADER)
  })

  it('writes one CRLF-terminated line per entry in header order', () => {
    expect(
      toAuditCsv([
        {
          id: 7,
          createdAt: '2026-06-07T08:30:00Z',
          targetType: 'BOOK',
          targetId: 10,
          action: 'UPDATE',
          actorLogin: 'admin',
          summary: 'Updated book.',
        },
        { id: 8, action: 'LOGOUT' },
      ]),
    ).toBe(
      `${HEADER}7,2026-06-07T08:30:00Z,BOOK,10,UPDATE,admin,Updated book.\r\n8,,,,LOGOUT,,\r\n`,
    )
  })

  it('quotes commas, quotes and line breaks and doubles inner quotes', () => {
    expect(toAuditCsv([{ id: 1, summary: 'Renamed "A", then B' }])).toBe(
      `${HEADER}1,,,,,,"Renamed ""A"", then B"\r\n`,
    )
    expect(toAuditCsv([{ id: 2, summary: 'line one\nline two' }])).toBe(
      `${HEADER}2,,,,,,"line one\nline two"\r\n`,
    )
    expect(toAuditCsv([{ id: 3, actorLogin: 'a\rb' }])).toBe(`${HEADER}3,,,,,"a\rb",\r\n`)
  })

  it('guards text that a spreadsheet would run as a formula', () => {
    expect(toAuditCsv([{ id: 4, summary: '=SUM(A1:A2)' }])).toBe(`${HEADER}4,,,,,,'=SUM(A1:A2)\r\n`)
    expect(toAuditCsv([{ id: 5, actorLogin: '@admin' }])).toBe(`${HEADER}5,,,,,'@admin,\r\n`)
    expect(toAuditCsv([{ id: 6, summary: '-1,+2' }])).toBe(`${HEADER}6,,,,,,"'-1,+2"\r\n`)
  })
})

describe('auditCsvFilename (hidden)', () => {
  const now = new Date('2026-03-04T23:59:30Z')

  it('names an unfiltered first page by the UTC date', () => {
    expect(auditCsvFilename({ page: 0 }, now)).toBe('audit-log-2026-03-04-page-1.csv')
    expect(auditCsvFilename({ page: 0 }, new Date('2026-03-05T00:00:01Z'))).toBe(
      'audit-log-2026-03-05-page-1.csv',
    )
  })

  it('adds target type and action in lower case, then the actor slug and the one-based page', () => {
    expect(
      auditCsvFilename(
        { targetType: 'USER_ACCOUNT', action: 'LOGIN_FAILURE', actorLogin: ' Jane.Doe@Example ', page: 2 },
        now,
      ),
    ).toBe('audit-log-2026-03-04-user_account-login_failure-jane-doe-example-page-3.csv')
  })

  it('leaves out empty filters and a login without letters or digits', () => {
    expect(
      auditCsvFilename({ targetType: '', action: 'CREATE', actorLogin: '***', page: 0 }, now),
    ).toBe('audit-log-2026-03-04-create-page-1.csv')
  })
})
