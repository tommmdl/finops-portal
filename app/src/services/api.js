import { fetchAuthSession } from 'aws-amplify/auth'
import { API_URL } from '../aws-config'

async function getHeaders() {
  const session = await fetchAuthSession()
  const token   = session.tokens?.idToken?.toString()
  return {
    'Content-Type':  'application/json',
    'Authorization': `Bearer ${token}`,
  }
}

async function request(method, path, body) {
  const headers = await getHeaders()
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

export const api = {
  listClients:  (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request('GET', `/clients${qs ? '?' + qs : ''}`)
  },
  getClient:    (id)       => request('GET',    `/clients/${id}`),
  createClient: (data)     => request('POST',   '/clients', data),
  updateClient: (id, data) => request('PUT',    `/clients/${id}`, data),
  deleteClient: (id)       => request('DELETE', `/clients/${id}`),
  generateReport: (data)   => request('POST',   '/reports/generate', data),
}
