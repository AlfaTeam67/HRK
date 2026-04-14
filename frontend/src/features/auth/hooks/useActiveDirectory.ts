interface ActiveDirectoryMock {
  isConfigured: boolean
  provider: 'Active Directory (mock)'
  domain: string
  mode: 'mock'
  reason: string
}

export function useActiveDirectory(): ActiveDirectoryMock {
  return {
    isConfigured: true,
    provider: 'Active Directory (mock)',
    domain: 'hrk.local',
    mode: 'mock',
    reason: 'Mock AD is enabled for frontend demo and local development.',
  }
}
