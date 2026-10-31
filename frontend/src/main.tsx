import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './index.css'
import { AuthProvider } from './lib/auth'
import Layout from './components/Layout'
import { RequireAuth, RequirePermission } from './components/Guards'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import CrmFields from './pages/CrmFields'
import Customers from './pages/Customers'
import ComingSoon from './pages/ComingSoon'
import Leads from './pages/Leads'
import Deals from './pages/Deals'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            <Route index element={<Dashboard />} />
            <Route
              path="crm/fields"
              element={
                <RequirePermission permission="CustomField.Read">
                  <CrmFields />
                </RequirePermission>
              }
            />
            <Route
              path="crm/customers"
              element={
                <RequirePermission permission="Customer.Read">
                  <Customers />
                </RequirePermission>
              }
            />
            <Route
              path="leads"
              element={
                <RequirePermission permission="Lead.Read">
                  <Leads />
                </RequirePermission>
              }
            />
            <Route
              path="deals"
              element={
                <RequirePermission permission="Deal.Read">
                  <Deals />
                </RequirePermission>
              }
            />
            <Route path="tickets" element={<ComingSoon title="Tickets" phase="Phase 3" />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
