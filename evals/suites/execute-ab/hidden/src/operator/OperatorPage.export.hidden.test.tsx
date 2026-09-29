// Hidden acceptance tests of the execute A/B task (evals/suites/execute-ab),
// copied into the run's copy only after the session ended.
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AUDIT_LOGS_PATH, type AuditLogPage } from '../api/operator'
import type { SessionResponse } from '../api/session'
import { OPERATOR_ROUTE_PATH, OperatorPage } from './OperatorPage'

const SESSION: SessionResponse = { authenticated: true, loginProviders: [] }

const PAGE: AuditLogPage = {
  content: [
    {
      id: 41,
      createdAt: '2026-06-07T08:30:00Z',
      targetType: 'BOOK',
      targetId: 10,
      action: 'UPDATE',
      actorLogin: 'admin',
      summary: 'Updated "Dune", second edition',
    },
  ],
  first: false,
  last: true,
  number: 2,
  numberOfElements: 1,
  size: 20,
  totalElements: 41,
  totalPages: 3,
}

function mockFetch(response: () => Response) {
  const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) =>
    Promise.resolve(
      String(input).startsWith(AUDIT_LOGS_PATH) ? response() : new Response(null, { status: 404 }),
    ),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function renderAt(entry: string) {
  const router = createMemoryRouter(
    [{ path: OPERATOR_ROUTE_PATH, element: <OperatorPage session={SESSION} /> }],
    { initialEntries: [entry] },
  )
  render(<RouterProvider router={router} />)
}

function exportButton() {
  return screen.getByRole('button', { name: 'Export CSV' })
}

const { createObjectURL, revokeObjectURL } = URL

describe('OperatorPage CSV export (hidden)', () => {
  afterEach(() => {
    Object.assign(URL, { createObjectURL, revokeObjectURL })
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('is disabled while loading and enabled once rows have loaded', async () => {
    mockFetch(() => Response.json(PAGE))
    renderAt(OPERATOR_ROUTE_PATH)
    expect(exportButton()).toBeDisabled()
    await screen.findByText('Updated "Dune", second edition')
    expect(exportButton()).toBeEnabled()
  })

  it('is disabled for an empty page and for a failed request', async () => {
    mockFetch(() => Response.json({ ...PAGE, content: [], numberOfElements: 0, totalElements: 0 }))
    renderAt(OPERATOR_ROUTE_PATH)
    await screen.findByText('No audit rows found')
    expect(exportButton()).toBeDisabled()
    vi.unstubAllGlobals()
    document.body.innerHTML = ''

    mockFetch(() => new Response(null, { status: 500 }))
    renderAt(OPERATOR_ROUTE_PATH)
    await screen.findByText('Audit rows unavailable')
    expect(exportButton()).toBeDisabled()
  })

  it('downloads the current page as CSV named by filters, date and page, then releases the URL', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-03-04T12:00:00Z'))
    const fetchMock = mockFetch(() => Response.json(PAGE))
    const blobs: Blob[] = []
    const createUrl = vi.fn((blob: Blob) => {
      blobs.push(blob)
      return 'blob:audit-export'
    })
    const revokeUrl = vi.fn()
    Object.assign(URL, { createObjectURL: createUrl, revokeObjectURL: revokeUrl })
    const clicked: { href: string; download: string }[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push({ href: this.href, download: this.download })
      expect(revokeUrl).not.toHaveBeenCalled()
    })

    renderAt(`${OPERATOR_ROUTE_PATH}?targetType=BOOK&action=UPDATE&actorLogin=Admin&page=2`)
    await screen.findByText('Updated "Dune", second edition')
    const requests = fetchMock.mock.calls.length
    fireEvent.click(exportButton())

    await waitFor(() => expect(revokeUrl).toHaveBeenCalledWith('blob:audit-export'))
    expect(clicked).toEqual([
      { href: 'blob:audit-export', download: 'audit-log-2026-03-04-book-update-admin-page-3.csv' },
    ])
    expect(blobs).toHaveLength(1)
    expect(blobs[0]?.type).toBe('text/csv;charset=utf-8')
    expect(await blobs[0]?.text()).toBe(
      'id,createdAt,targetType,targetId,action,actorLogin,summary\r\n' +
        '41,2026-06-07T08:30:00Z,BOOK,10,UPDATE,admin,"Updated ""Dune"", second edition"\r\n',
    )
    expect(fetchMock.mock.calls.length).toBe(requests)
  })
})
